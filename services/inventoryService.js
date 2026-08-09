const pool = require('../db');

const DEFAULT_THRESHOLD = 10;

async function getLowStockProducts(tenantId, threshold = DEFAULT_THRESHOLD) {
  const res = await pool.query('SELECT id, tenant_id, name, sku, barcode, stock_quantity, low_stock_threshold FROM products WHERE tenant_id = $1 AND (stock_quantity::int <= COALESCE(low_stock_threshold::int, $2))', [tenantId, threshold]);
  return res.rows;
}

async function generateRestockDrafts(tenantId, threshold = DEFAULT_THRESHOLD) {
  const items = await getLowStockProducts(tenantId, threshold);
  // Return simple draft objects - frontend can transform into messages or PO drafts
  return items.map((it) => ({ product_id: it.id, name: it.name, suggested_reorder: Math.max(it.low_stock_threshold * 2 - (it.stock_quantity || 0), 1) }));
}

module.exports = { getLowStockProducts, generateRestockDrafts };

async function createPurchaseOrdersFromDrafts(tenantId, drafts = [], supplierId = null) {
  if (!drafts || drafts.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderNumber = `PO-${Date.now()}-${tenantId}`;
    // calculate totals using product cost_price or price
    let total = 0;
    const itemsToInsert = [];
    for (const d of drafts) {
      const prodRes = await client.query('SELECT id, cost_price, price FROM products WHERE id = $1 AND tenant_id = $2', [d.product_id, tenantId]);
      const prod = prodRes.rows[0] || {};
      const unit = Number(prod.cost_price || prod.price || 0);
      const qty = Number(d.suggested_reorder || 1);
      const line = unit * qty;
      total += line;
      itemsToInsert.push({ product_id: d.product_id, quantity: qty, unit_price: unit, line_total: line });
    }
    const poRes = await client.query(
      `INSERT INTO purchase_orders (tenant_id, supplier_id, order_number, status, total_amount, currency, expected_delivery_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, supplierId, orderNumber, 'Pending', total || 0, 'TZS', null, 'Auto-generated from restock drafts']
    );
    const po = poRes.rows[0];
    for (const it of itemsToInsert) {
      await client.query(
        `INSERT INTO purchase_order_items (tenant_id, purchase_order_id, product_id, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, po.id, it.product_id, it.quantity, it.unit_price, it.line_total]
      );
    }
    await client.query('COMMIT');
    return po;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getLowStockProducts, generateRestockDrafts, createPurchaseOrdersFromDrafts };
