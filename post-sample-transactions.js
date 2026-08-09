(async () => {
  try {
    const base = 'http://localhost:5000';
    // Using tenant 3 (Jenga Plus Ltd) and known records from seed
    const tenantId = 3;
    const customerId = 1; // Alpha Construction Ltd
    const saleId = 1; // INV-1001

    console.log('Creating customer debt for Alpha Construction (1,000,000)');
    let res = await fetch(`${base}/api/customers/${customerId}/debt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, sale_reference: 'INV-2001', amount: 1000000, due_date: '2026-09-01' })
    });
    console.log('Debt response status:', res.status);
    console.log(await res.json());

    console.log('Applying partial payment of 500,000 for Alpha Construction');
    res = await fetch(`${base}/api/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, amount: 500000, payment_method: 'Bank Transfer' })
    });
    console.log('Payment response status:', res.status);
    console.log(await res.json());

    console.log('Creating refund for sale INV-1001 (200,000)');
    res = await fetch(`${base}/api/sales/${saleId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, refund_amount: 200000, reason: 'Damaged goods' })
    });
    console.log('Refund response status:', res.status);
    console.log(await res.json());

    process.exit(0);
  } catch (e) {
    console.error('Transaction script error:', e.message || e);
    process.exit(1);
  }
})();
