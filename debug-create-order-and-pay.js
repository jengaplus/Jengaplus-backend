const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // create tenant if not exists
    const t = await client.query("INSERT INTO tenants (business_name, subdomain) VALUES ($1,$2) ON CONFLICT (subdomain) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING *", ['Debug Tenant', 'debug-tenant']);
    const tenantId = t.rows[0].id;
    // create product
    const p = await client.query("INSERT INTO products (tenant_id, category, name, sku, barcode, unit, price, stock_quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name RETURNING *", [tenantId, 'Test', 'Debug Bricks', 'DBG-BRICK-001', 'DBG123456', 'Pieces', 1500, 100]);
    const productId = p.rows[0].id;
    // create customer
    const c = await client.query("INSERT INTO customers (tenant_id, name, phone, address) VALUES ($1,$2,$3,$4) RETURNING *", [tenantId, 'Debug Customer', process.env.ADMIN_PHONE || '+255626522599', 'Debug Address']);
    const customerId = c.rows[0].id;
    // create sale
    const s = await client.query(`INSERT INTO sales (tenant_id, salesperson_id, customer_id, customer_name, invoice_number, total_amount, payment_method, payment_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [tenantId, null, customerId, 'Debug Customer', 'INV-DEBUG-001', 3000, 'Mock', 'Pending']);
    const saleId = s.rows[0].id;
    // create sales_items
    await client.query(`INSERT INTO sales_items (tenant_id, sale_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5,$6)`, [tenantId, saleId, productId, 2, 1500, 3000]);

    await client.query('COMMIT');
    console.log('Created test sale', saleId);

    // Call mock-checkout endpoint
    const url = (process.env.API_BASE || 'http://localhost:5000') + '/api/payments/mock-checkout';
    console.log('Calling', url, 'with NEXTSMS_DRYRUN=true');
    const resp = await axios.post(url, { orderId: saleId, network: 'MockNet', amount: 3000 }, { timeout: 20000 });
    console.log('Mock-checkout response:', resp.data);

    // check receipt file
    const path = require('path');
    const fs = require('fs');
    const receiptPath = path.join(__dirname, 'receipts', `invoice-${saleId}.pdf`);
    console.log('Receipt exists?', fs.existsSync(receiptPath), receiptPath);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('Error in debug script:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();
