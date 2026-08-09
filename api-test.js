 (async () => {
  try {
    const base = 'http://localhost:5000';
    const tenantsRes = await fetch(base + '/api/tenants');
    const tenants = await tenantsRes.json();
    console.log('TENANTS:', tenants);

    const tenant = tenants.find(t => t.business_name && t.business_name.toLowerCase().includes('jenga')) || tenants[0];
    if (!tenant) {
      console.error('No tenant found');
      process.exit(1);
    }

    const id = tenant.id;
    console.log('Using tenant:', tenant);

    const endpoints = [
      `/api/dashboard/${id}`,
      `/api/products/${id}`,
      `/api/customers/${id}`,
      `/api/sales/${id}`,
      `/api/suppliers/${id}`,
      `/api/vehicles/${id}`,
      `/api/deliveries/${id}`,
      `/api/refunds/${id}`,
      `/api/customers/${id}/debts`,
      `/api/customers/${id}/payments`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(base + ep);
        const json = await res.json();
        console.log('\nENDPOINT:', ep);
        console.log(JSON.stringify(json, null, 2));
      } catch (err) {
        console.error('Error fetching', ep, err.message || err);
      }
    }

    process.exit(0);
  } catch (e) {
    console.error('API test error:', e.message || e);
    process.exit(1);
  }
})();
