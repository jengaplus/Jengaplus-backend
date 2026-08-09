const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configure PostgreSQL connection using DATABASE_URL (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    console.log('Starting seed process...');

    // Create tenants
    console.log('Ensuring tenant Jenga Plus Ltd exists...');
    // Use upsert to avoid duplicate-subdomain errors when re-running seed
    const tenantRes = await pool.query(
      `INSERT INTO tenants (business_name, subdomain, subscription_status)
       VALUES ($1, $2, $3)
       ON CONFLICT (subdomain) DO UPDATE SET business_name = EXCLUDED.business_name, subscription_status = EXCLUDED.subscription_status
       RETURNING *`,
      ['Jenga Plus Ltd', 'jengaplus', 'Active']
    );
    const tenant = tenantRes.rows[0];

    // Create users with bcrypt hashed passwords (password: 12345678)
    const plainPassword = '12345678';
    const hashed = await bcrypt.hash(plainPassword, 10);

    console.log('Creating users...');
    const users = [
      { name: 'Boss User', email: 'boss@jengaplus.com', role: 'Boss' },
      { name: 'Site Manager', email: 'site@jengaplus.com', role: 'Manager' },
      { name: 'Chief Foreman', email: 'fundi@jengaplus.com', role: 'Foreman' }
    ];

    for (const u of users) {
      const existing = await pool.query(`SELECT id FROM users WHERE tenant_id = $1 AND email = $2`, [tenant.id, u.email]);
      if (existing.rows.length) {
        console.log(`User exists, skipping: ${u.email}`);
        continue;
      }
      await pool.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, is_verified) VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenant.id, u.name, u.email, hashed, u.role, true]
      );
    }

    // Projects: We'll store as 'suppliers' table or products? There's no explicit projects table. Create a projects-like dataset using 'purchase_orders' with project reference in notes and create a simple 'projects' helper table.
    console.log('Creating projects table (helper) and sample projects...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        budget DECIMAL(12,2),
        start_date DATE,
        end_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const projectSamples = [
      { name: 'Arusha Mall Extension', location: 'Arusha', budget: 1200000000, start_date: '2026-02-01', end_date: '2026-12-31' },
      { name: 'Dar es Salaam Waterfront Redevelopment', location: 'Dar es Salaam', budget: 3500000000, start_date: '2026-03-15', end_date: '2027-06-30' },
      { name: 'Mwanza Residential Towers Phase I', location: 'Mwanza', budget: 800000000, start_date: '2026-05-01', end_date: '2027-01-31' }
    ];

    const createdProjects = [];
    for (const p of projectSamples) {
      const exist = await pool.query(`SELECT * FROM projects WHERE tenant_id = $1 AND name = $2`, [tenant.id, p.name]);
      if (exist.rows.length) {
        createdProjects.push(exist.rows[0]);
        continue;
      }
      const pr = await pool.query(
        `INSERT INTO projects (tenant_id, name, location, budget, start_date, end_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenant.id, p.name, p.location, p.budget, p.start_date, p.end_date, 'Seeded sample project']
      );
      createdProjects.push(pr.rows[0]);
    }

    // Products / Materials
    console.log('Creating materials inventory...');
    const materials = [
      { category: 'Cement', name: 'Dangote Cement 50kg', unit: 'Bag', price: 18000, cost_price: 14000, stock: 1200 },
      { category: 'Sand', name: 'River Sand (m3)', unit: 'm3', price: 45000, cost_price: 30000, stock: 300 },
      { category: 'Gravel', name: 'Crushed Stone (m3)', unit: 'm3', price: 55000, cost_price: 38000, stock: 250 },
      { category: 'Steel', name: 'Rebar 12mm', unit: 'Piece', price: 1200, cost_price: 900, stock: 5000 },
      { category: 'Bricks', name: 'Burnt Clay Brick', unit: 'Piece', price: 350, cost_price: 200, stock: 50000 }
    ];

    for (const m of materials) {
      const exist = await pool.query(`SELECT id FROM products WHERE tenant_id = $1 AND name = $2`, [tenant.id, m.name]);
      if (exist.rows.length) {
        console.log(`Product exists, skipping: ${m.name}`);
        continue;
      }
      await pool.query(
        `INSERT INTO products (tenant_id, category, name, unit, price, cost_price, stock_quantity, low_stock_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tenant.id, m.category, m.name, m.unit, m.price, m.cost_price || 0, m.stock, 10]
      );
    }
      else {
        // Ensure cost_price is set/updated for existing products
        await pool.query('UPDATE products SET cost_price = $1 WHERE id = $2', [m.cost_price || 0, exist.rows[0].id]);
      }

    // Suppliers
    console.log('Creating sample suppliers...');
    const supExists = await pool.query(`SELECT * FROM suppliers WHERE tenant_id = $1 AND name = $2`, [tenant.id, 'Tanzania Ready Mix']);
    let sup;
    if (supExists.rows.length) {
      sup = supExists;
      console.log('Supplier exists, reusing');
    } else {
      sup = await pool.query(
        `INSERT INTO suppliers (tenant_id, name, contact_person, phone, email, address, rating, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [tenant.id, 'Tanzania Ready Mix', 'Selina M', '+255712345678', 'sales@trm.co.tz', 'Dar es Salaam', 5, 'Preferred supplier']
      );
    }

    // Purchase Orders as sample procurement
    console.log('Creating purchase orders...');
    const poExists = await pool.query(`SELECT * FROM purchase_orders WHERE tenant_id = $1 AND order_number = $2`, [tenant.id, 'PO-0001']);
    if (!poExists.rows.length) {
      await pool.query(
        `INSERT INTO purchase_orders (tenant_id, supplier_id, order_number, status, total_amount, expected_delivery_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenant.id, sup.rows[0].id, 'PO-0001', 'Received', 90000000, '2026-02-10', 'Initial bulk cement order for Arusha Mall']
      );
    } else {
      console.log('Purchase order PO-0001 exists, skipping');
    }

    // Customers
    console.log('Creating customers...');
    const cust1Exists = await pool.query(`SELECT * FROM customers WHERE tenant_id = $1 AND name = $2`, [tenant.id, 'Alpha Construction Ltd']);
    let cust1;
    if (cust1Exists.rows.length) cust1 = cust1Exists;
    else cust1 = await pool.query(
      `INSERT INTO customers (tenant_id, name, phone, address, category, credit_limit, loyalty_tier) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenant.id, 'Alpha Construction Ltd', '+255788111222', 'Arusha', 'Wholesale', 50000000, 'Gold']
    );

    const cust2Exists = await pool.query(`SELECT * FROM customers WHERE tenant_id = $1 AND name = $2`, [tenant.id, 'Beta Builders']);
    let cust2;
    if (cust2Exists.rows.length) cust2 = cust2Exists;
    else cust2 = await pool.query(
      `INSERT INTO customers (tenant_id, name, phone, address, category, credit_limit, loyalty_tier) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenant.id, 'Beta Builders', '+255754987654', 'Dar es Salaam', 'Retail', 10000000, 'Silver']
    );

    // Sales & Orders (populate history)
    console.log('Creating sales and sales items...');
    const productRows = (await pool.query('SELECT * FROM products WHERE tenant_id = $1', [tenant.id])).rows;

    // Helper to get product by category/name
    const findProduct = (namePart) => productRows.find(p => p.name.includes(namePart) || p.category.includes(namePart));

    // Insert sales if invoices don't already exist
    const sale1Exists = await pool.query(`SELECT * FROM sales WHERE tenant_id = $1 AND invoice_number = $2`, [tenant.id, 'INV-1001']);
    if (!sale1Exists.rows.length) {
      const sale1 = await pool.query(
        `INSERT INTO sales (tenant_id, salesperson_id, customer_id, invoice_number, customer_name, total_amount, discount_amount, tax_amount, payment_method, payment_status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [tenant.id, null, cust1.rows[0].id, 'INV-1001', cust1.rows[0].name, 4500000, 0, 0, 'Mobile Money', 'Paid', 'Bulk cement purchase for Arusha Mall']
      );
      await pool.query(
        `INSERT INTO sales_items (tenant_id, sale_id, product_id, quantity, unit_price, discount, line_total) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenant.id, sale1.rows[0].id, findProduct('Dangote Cement 50kg').id, 200, 18000, 0, 200 * 18000]
      );
    } else console.log('Invoice INV-1001 exists, skipping');

    const sale2Exists = await pool.query(`SELECT * FROM sales WHERE tenant_id = $1 AND invoice_number = $2`, [tenant.id, 'INV-1002']);
    if (!sale2Exists.rows.length) {
      const sale2 = await pool.query(
        `INSERT INTO sales (tenant_id, salesperson_id, customer_id, invoice_number, customer_name, total_amount, discount_amount, tax_amount, payment_method, payment_status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [tenant.id, null, cust2.rows[0].id, 'INV-1002', cust2.rows[0].name, 1500000, 0, 0, 'Cash', 'Paid', 'Bricks and sand for small residential build']
      );
      await pool.query(
        `INSERT INTO sales_items (tenant_id, sale_id, product_id, quantity, unit_price, discount, line_total) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenant.id, sale2.rows[0].id, findProduct('Burnt Clay Brick').id, 3000, 350, 0, 3000 * 350]
      );
    } else console.log('Invoice INV-1002 exists, skipping');

    // Create vehicle and deliveries
    console.log('Creating vehicles and a delivery...');
    // Create or reuse vehicle
    const vehExists = await pool.query(`SELECT * FROM vehicles WHERE tenant_id = $1 AND plate = $2`, [tenant.id, 'T-ARU-123']);
    let veh;
    if (vehExists.rows.length) {
      veh = vehExists.rows[0];
      console.log('Vehicle exists, reusing');
    } else {
      const vehRes = await pool.query(
        `INSERT INTO vehicles (tenant_id, plate, type, capacity, status) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenant.id, 'T-ARU-123', 'Lorry', '10 Tonnes', 'Active']
      );
      veh = vehRes.rows[0];
    }

    // Insert delivery (skip if similar delivery exists)
    const deliveryExists = await pool.query(`SELECT * FROM deliveries WHERE tenant_id = $1 AND vehicle_id = $2 AND destination = $3`, [tenant.id, veh.id, 'Arusha Mall Site']);
    if (!deliveryExists.rows.length) {
      await pool.query(
        `INSERT INTO deliveries (tenant_id, driver_id, vehicle_id, customer_name, customer_address, destination, status, route_start, route_end, distance_km, eta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [tenant.id, null, veh.id, cust1.rows[0].name, cust1.rows[0].address, 'Arusha Mall Site', 'Delivered', 'Depot', 'Site', 12.5, new Date()]
      );
    } else {
      console.log('Delivery to Arusha Mall Site exists, skipping');
    }

    // Expenses
    console.log('Seeding expenses...');
    await pool.query(
      `INSERT INTO expenses (tenant_id, category, vendor, amount, currency, payment_method, expense_date, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenant.id, 'Logistics', 'Local Haulers Ltd', 250000, 'TZS', 'Bank Transfer', '2026-02-12', 'Transport of materials to Arusha Mall']
    );

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
