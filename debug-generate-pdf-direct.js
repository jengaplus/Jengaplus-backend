const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { createInvoicePDFFile } = require('./services/pdfService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query("INSERT INTO tenants (business_name, subdomain) VALUES ($1,$2) ON CONFLICT (subdomain) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING *", ['PDF Tenant', 'pdf-tenant']);
    const tenantId = t.rows[0].id;
    const p = await client.query("INSERT INTO products (tenant_id, category, name, sku, barcode, unit, price, stock_quantity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name RETURNING *", [tenantId, 'Test', 'PDF Bricks', 'PDF-BRICK-001', 'PDF123456', 'Pieces', 2000, 50]);
    const productId = p.rows[0].id;
    const c = await client.query("INSERT INTO customers (tenant_id, name, phone, address) VALUES ($1,$2,$3,$4) RETURNING *", [tenantId, 'PDF Customer', process.env.ADMIN_PHONE || '+255626522599', 'PDF Address']);
    const customerId = c.rows[0].id;
    const s = await client.query(`INSERT INTO sales (tenant_id, salesperson_id, customer_id, customer_name, invoice_number, total_amount, payment_method, payment_status, stock_deducted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [tenantId, null, customerId, 'PDF Customer', 'INV-PDF-001', 4000, 'Mock', 'Paid', true]);
    const saleId = s.rows[0].id;
    await client.query(`INSERT INTO sales_items (tenant_id, sale_id, product_id, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5,$6)`, [tenantId, saleId, productId, 2, 2000, 4000]);
    await client.query('COMMIT');

    const itemsRes = await pool.query('SELECT si.quantity, si.unit_price, si.line_total, p.name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1', [saleId]);
    const items = itemsRes.rows.map(r=>({name: r.name, quantity: r.quantity, unit_price: r.unit_price, line_total: r.line_total}));
    const cust = (await pool.query('SELECT * FROM customers WHERE id = $1',[customerId])).rows[0];
    const receiptsDir = path.join(__dirname,'receipts'); if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir,{recursive:true});
    const receiptPath = path.join(receiptsDir, `invoice-${saleId}.pdf`);
    await createInvoicePDFFile(s.rows[0], items, cust, receiptPath);
    console.log('PDF created at', receiptPath);
  } catch (err) {
    try{ await client.query('ROLLBACK'); } catch(e){}
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();
