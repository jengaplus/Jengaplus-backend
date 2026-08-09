const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function streamInvoicePDF(res, sale, items = [], customer = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${sale.id}.pdf"`);

  doc.pipe(res);

  // Header
  doc.fontSize(20).text('Jenga Plus', { align: 'left' });
  doc.fontSize(10).text('Professional Construction Supplies', { align: 'left' });
  doc.moveDown();

  // Order & Customer info
  doc.fontSize(12).text(`Invoice / Receipt #: ${sale.invoice_number || sale.id}`, { continued: false });
  doc.text(`Order ID: ${sale.id}`);
  doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`);
  doc.moveDown();

  doc.text('Bill To:', { underline: true });
  doc.text(`${customer.name || sale.customer_name || 'N/A'}`);
  if (customer.phone) doc.text(`Phone: ${customer.phone}`);
  if (customer.address) doc.text(`${customer.address}`);
  doc.moveDown();

  // Table header
  doc.fontSize(11).text('Item', 50, doc.y, { width: 250 });
  doc.text('Qty', 320, doc.y, { width: 60, align: 'right' });
  doc.text('Unit Price', 380, doc.y, { width: 80, align: 'right' });
  doc.text('Line Total', 470, doc.y, { width: 80, align: 'right' });
  doc.moveDown();

  // Items
  let total = 0;
  items.forEach((it) => {
    const name = it.name || it.product_name || 'Item';
    const qty = it.quantity || 0;
    const unit = Number(it.unit_price || it.price || 0);
    const line = Number(it.line_total || (qty * unit));
    total += line;

    doc.fontSize(10).text(name, 50, doc.y, { width: 250 });
    doc.text(String(qty), 320, doc.y, { width: 60, align: 'right' });
    doc.text(unit.toFixed(2), 380, doc.y, { width: 80, align: 'right' });
    doc.text(line.toFixed(2), 470, doc.y, { width: 80, align: 'right' });
    doc.moveDown();
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total Paid: TZS ${Number(sale.total_amount || total).toFixed(2)}`, { align: 'right' });
  doc.text(`Payment Status: ${sale.payment_status || 'N/A'}`, { align: 'right' });
  doc.moveDown();

  doc.fontSize(9).text('Thank you for your purchase. For inquiries, contact support@jengaplus.com', { align: 'center' });

  doc.end();
}

module.exports = {
  streamInvoicePDF
};

function createInvoicePDFFile(sale, items = [], customer = {}, outPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);

      doc.fontSize(20).text('Jenga Plus', { align: 'left' });
      doc.fontSize(10).text('Professional Construction Supplies', { align: 'left' });
      doc.moveDown();

      doc.fontSize(12).text(`Invoice / Receipt #: ${sale.invoice_number || sale.id}`, { continued: false });
      doc.text(`Order ID: ${sale.id}`);
      doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`);
      doc.moveDown();

      doc.text('Bill To:', { underline: true });
      doc.text(`${customer.name || sale.customer_name || 'N/A'}`);
      if (customer.phone) doc.text(`Phone: ${customer.phone}`);
      if (customer.address) doc.text(`${customer.address}`);
      doc.moveDown();

      doc.fontSize(11).text('Item', 50, doc.y, { width: 250 });
      doc.text('Qty', 320, doc.y, { width: 60, align: 'right' });
      doc.text('Unit Price', 380, doc.y, { width: 80, align: 'right' });
      doc.text('Line Total', 470, doc.y, { width: 80, align: 'right' });
      doc.moveDown();

      let total = 0;
      items.forEach((it) => {
        const name = it.name || it.product_name || 'Item';
        const qty = it.quantity || 0;
        const unit = Number(it.unit_price || it.price || 0);
        const line = Number(it.line_total || (qty * unit));
        total += line;

        doc.fontSize(10).text(name, 50, doc.y, { width: 250 });
        doc.text(String(qty), 320, doc.y, { width: 60, align: 'right' });
        doc.text(unit.toFixed(2), 380, doc.y, { width: 80, align: 'right' });
        doc.text(line.toFixed(2), 470, doc.y, { width: 80, align: 'right' });
        doc.moveDown();
      });

      doc.moveDown();
      doc.fontSize(12).text(`Total Paid: TZS ${Number(sale.total_amount || total).toFixed(2)}`, { align: 'right' });
      doc.text(`Payment Status: ${sale.payment_status || 'N/A'}`, { align: 'right' });
      doc.moveDown();

      doc.fontSize(9).text('Thank you for your purchase. For inquiries, contact support@jengaplus.com', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(outPath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  streamInvoicePDF,
  createInvoicePDFFile
};
