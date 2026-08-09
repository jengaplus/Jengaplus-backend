const base = 'http://10.36.51.199:5000';
const run = async () => {
  const log = (label, value) => console.log(`\n=== ${label} ===\n`, JSON.stringify(value, null, 2));
  try {
    const root = await fetch(`${base}/`);
    log('GET /', await root.json());

    const customerBody = {
      tenant_id: 1,
      name: 'Azizi Construction Supplies',
      phone: '0712345678',
      address: 'Kilimani, Dar es Salaam',
      category: 'Wholesale',
      credit_limit: '1500000',
      loyalty_tier: 'Silver'
    };
    const createCustomer = await fetch(`${base}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerBody)
    });
    log('POST /api/customers', await createCustomer.json());

    const customers = await fetch(`${base}/api/customers/1`);
    log('GET /api/customers/1', await customers.json());

    const expenseBody = {
      tenant_id: 1,
      category: 'Transport',
      vendor: 'Diesel Station',
      amount: '85000',
      currency: 'TZS',
      payment_method: 'Cash',
      expense_date: new Date().toISOString(),
      description: 'Fuel purchase for delivery trip'
    };
    const createExpense = await fetch(`${base}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseBody)
    });
    log('POST /api/expenses', await createExpense.json());

    const expenses = await fetch(`${base}/api/expenses/1`);
    log('GET /api/expenses/1', await expenses.json());

    const summary = await fetch(`${base}/api/finance/summary/1`);
    log('GET /api/finance/summary/1', await summary.json());
  } catch (err) {
    console.error('ERROR', err);
  }
};
run();
