const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',') + '\n';
  const lines = rows.map(r => keys.map(k => {
    let v = r[k];
    if (v === null || v === undefined) return '';
    if (v instanceof Date) v = v.toISOString();
    return String(v).replace(/"/g, '""');
  }).map(cell => `"${cell}"`).join(','));
  return header + lines.join('\n');
}

(async ()=>{
  try {
    const tenantId = 3; // Jenga Plus Ltd
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

    const queries = {
      products: 'SELECT * FROM products WHERE tenant_id = $1',
      customers: 'SELECT * FROM customers WHERE tenant_id = $1',
      sales: "SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.tenant_id = $1",
      sales_items: 'SELECT * FROM sales_items WHERE tenant_id = $1',
      suppliers: 'SELECT * FROM suppliers WHERE tenant_id = $1',
      vehicles: 'SELECT * FROM vehicles WHERE tenant_id = $1',
      deliveries: 'SELECT d.*, v.plate AS vehicle_plate FROM deliveries d LEFT JOIN vehicles v ON v.id = d.vehicle_id WHERE d.tenant_id = $1',
      debts: 'SELECT * FROM customer_debts WHERE tenant_id = $1',
      payments: 'SELECT * FROM customer_payments WHERE tenant_id = $1',
      refunds: 'SELECT r.*, s.invoice_number, c.name AS customer_name FROM refunds r LEFT JOIN sales s ON s.id = r.sale_id LEFT JOIN customers c ON c.id = s.customer_id WHERE r.tenant_id = $1'
    };

    for (const [name, q] of Object.entries(queries)) {
      const res = await pool.query(q, [tenantId]);
      const csv = toCSV(res.rows);
      const file = path.join(exportDir, `${name}.csv`);
      fs.writeFileSync(file, csv, 'utf8');
      console.log(`Wrote ${file} (${res.rows.length} rows)`);
    }

    await pool.end();
    console.log('Export complete. Files are in backend/exports/');
    process.exit(0);
  } catch (e) {
    console.error('Export error:', e.message || e);
    process.exit(1);
  }
})();
