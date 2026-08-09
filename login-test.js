(async () => {
  try {
    const base = 'http://localhost:5000';
    const users = [
      { email: 'boss@jengaplus.com', password: '12345678' },
      { email: 'site@jengaplus.com', password: '12345678' },
      { email: 'fundi@jengaplus.com', password: '12345678' },
      { email: 'admin@jengaplus.com', password: 'Admin@1234' }
    ];

    for (const u of users) {
      try {
        const res = await fetch(base + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: u.email, password: u.password })
        });
        const json = await res.json();
        console.log('\nLOGIN:', u.email);
        console.log(json);
        if (json.token) {
          const meRes = await fetch(base + '/api/auth/me', { headers: { Authorization: 'Bearer ' + json.token } });
          const me = await meRes.json();
          console.log('ME:', me);
        }
      } catch (err) {
        console.error('Error logging in', u.email, err.message || err);
      }
    }

    process.exit(0);
  } catch (e) {
    console.error('Login test error:', e.message || e);
    process.exit(1);
  }
})();
