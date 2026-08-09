require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const saleRes = await pool.query("SELECT * FROM sales WHERE invoice_number='INV-1001'");
    console.log('SALE:', JSON.stringify(saleRes.rows, null, 2));
    if (saleRes.rows.length) {
      const saleId = saleRes.rows[0].id;
      const items = await pool.query('SELECT si.*, p.name, p.stock_quantity FROM sales_items si LEFT JOIN products p ON p.id=si.product_id WHERE si.sale_id=$1', [saleId]);
      console.log('ITEMS:', JSON.stringify(items.rows, null, 2));
      const prods = items.rows.map(r => ({ product_id: r.product_id, name: r.name, stock: r.stock_quantity }));
      console.log('PRODUCTS:', JSON.stringify(prods, null, 2));
    }
    await pool.end();
  } catch (e) {
    console.error('ERROR', e);
    try { await pool.end(); } catch (__) {}
    process.exit(1);
  }
})();
