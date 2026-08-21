const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const smsService = require('./services/smsService');
const { streamInvoicePDF } = require('./services/pdfService');
const inventoryService = require('./services/inventoryService');

// Require environment variables - no hardcoded defaults for security
const JWT_SECRET = process.env.JWT_SECRET;
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME;
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
const SUPERADMIN_ADMISSION = process.env.SUPERADMIN_ADMISSION;
const OTP_EXPIRATION_MINUTES = 10;
const PASSWORD_RESET_EXPIRATION_MINUTES = 60;
const DEMO_AUTH_RESPONSES = String(process.env.DEMO_AUTH_RESPONSES || 'false').toLowerCase() === 'true';

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'SUPERADMIN_EMAIL', 'SUPERADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please configure these in your .env file');
  process.exit(1);
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Muunganisho wa PostgreSQL
const poolConfig = {
  connectionString: process.env.DATABASE_URL
};

if (process.env.PGSSLMODE && process.env.PGSSLMODE.toLowerCase() !== 'disable') {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.PGSSLVERIFY ? process.env.PGSSLVERIFY.toLowerCase() !== 'false' : false
  };
} else if (process.env.DATABASE_URL && /(localhost|127\.0\.0\.1|::1)/.test(process.env.DATABASE_URL)) {
  poolConfig.ssl = false;
}

const pool = new Pool(poolConfig);

// === FULL RESET & REBUILD DATABASE SCHEMA FROM SCRATCH ===
const resetAndInitializeDatabase = async () => {
  try {
    console.log("🗑️ Dropping old database tables if they exist...");
    await pool.query(`
      DROP TABLE IF EXISTS delivery_gps_logs CASCADE;
      DROP TABLE IF EXISTS deliveries CASCADE;
      DROP TABLE IF EXISTS vehicles CASCADE;
      DROP TABLE IF EXISTS refunds CASCADE;
      DROP TABLE IF EXISTS sales_items CASCADE;
      DROP TABLE IF EXISTS sales CASCADE;
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS customer_payments CASCADE;
      DROP TABLE IF EXISTS customer_debts CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS tenants CASCADE;
    `);

    console.log("🏗️ Creating fresh database tables from scratch...");

    // 1. Tenants Table (Multi-tenant isolation)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE,
        subscription_status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Users Table (Multi-role architecture)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, -- SuperAdmin, Boss, Manager, Salesperson, Driver
        admission VARCHAR(100),
        is_verified BOOLEAN DEFAULT false,
        two_factor_enabled BOOLEAN DEFAULT false,
        otp_code VARCHAR(10),
        otp_expires TIMESTAMP,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Inventory & Products Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL, -- Matofali, Nondo, Simenti, Mchanga, Tiles, Mabati, etc.
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE,
        barcode VARCHAR(100) UNIQUE,
        unit VARCHAR(50) NOT NULL, -- Bags, Pieces, Tonnes, Lorry loads, Bundles
        price DECIMAL(12, 2) NOT NULL,
        cost_price DECIMAL(12, 2) DEFAULT 0,
        stock_quantity INT DEFAULT 0,
        low_stock_threshold INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`);

    // 6. Customer Management Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        category VARCHAR(50) DEFAULT 'Retail', -- Wholesale, Retail, Regular
        credit_score INT DEFAULT 650,
        credit_limit DECIMAL(12, 2) DEFAULT 0,
        outstanding_balance DECIMAL(12, 2) DEFAULT 0,
        loyalty_points INT DEFAULT 0,
        loyalty_tier VARCHAR(50) DEFAULT 'Bronze',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_debts (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
        sale_reference VARCHAR(255),
        amount DECIMAL(12, 2) NOT NULL,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'Outstanding',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_payments (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
        debt_id INT REFERENCES customer_debts(id) ON DELETE SET NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        notes TEXT,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        rating INT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(150) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        total_amount DECIMAL(12, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'TZS',
        expected_delivery_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        quantity INT DEFAULT 1,
        unit_price DECIMAL(12,2) DEFAULT 0,
        line_total DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Gamification tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        code VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        points INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        badge_id INT REFERENCES badges(id) ON DELETE CASCADE,
        awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        work_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'Present',
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Sales & POS Invoices Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        salesperson_id INT REFERENCES users(id),
        customer_id INT REFERENCES customers(id),
        invoice_number VARCHAR(100) UNIQUE,
        customer_name VARCHAR(255),
        total_amount DECIMAL(12, 2) NOT NULL,
        discount_amount DECIMAL(12, 2) DEFAULT 0,
        tax_amount DECIMAL(12, 2) DEFAULT 0,
        payment_method VARCHAR(50) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'Paid',
        order_status VARCHAR(50) DEFAULT 'Pending',
        driver_name VARCHAR(255),
        driver_phone VARCHAR(50),
        stock_deducted BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales_items (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        quantity INT DEFAULT 1,
        unit_price DECIMAL(12, 2) NOT NULL,
        discount DECIMAL(12, 2) DEFAULT 0,
        line_total DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
        refund_amount DECIMAL(12, 2) NOT NULL,
        reason TEXT,
        refunded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Fleet & Vehicle Tracking Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        plate VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(100) NOT NULL,
        capacity VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Active',
        assigned_driver_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        driver_id INT REFERENCES users(id),
        vehicle_id INT REFERENCES vehicles(id),
        customer_name VARCHAR(255),
        customer_address TEXT,
        destination TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        route_start VARCHAR(255),
        route_end VARCHAR(255),
        distance_km DECIMAL(10, 2) DEFAULT 0,
        proof_of_delivery_url TEXT,
        eta TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_gps_logs (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        delivery_id INT REFERENCES deliveries(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 7),
        longitude DECIMAL(10, 7),
        speed_kmh DECIMAL(8, 2),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Expense and Financial Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        vendor VARCHAR(255),
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'TZS',
        payment_method VARCHAR(50) DEFAULT 'Cash',
        expense_date DATE DEFAULT CURRENT_DATE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const tenant1 = await pool.query(
      'INSERT INTO tenants (business_name, subdomain, subscription_status) VALUES ($1, $2, $3) RETURNING *',
      ['Marco Materials Ltd', 'marco-materials', 'Active']
    );

    const tenant2 = await pool.query(
      'INSERT INTO tenants (business_name, subdomain, subscription_status) VALUES ($1, $2, $3) RETURNING *',
      ['JengaPlus Building Supply', 'jengaplus-building', 'Active']
    );

    const passwordBoss = await bcrypt.hash('Boss@1234', 10);
    const passwordSales = await bcrypt.hash('Sales@1234', 10);
    const passwordManager = await bcrypt.hash('Manager@1234', 10);
    const passwordDriver = await bcrypt.hash('Driver@1234', 10);

    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenant1.rows[0].id, 'Josia Makungu Marco', 'boss@marco.com', passwordBoss, 'Boss', 'ATC-2026-0981', true]
    );

    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenant1.rows[0].id, 'Laureen Charles Massawe', 'sales@marco.com', passwordSales, 'Salesperson', 'ATC-2026-0442', true]
    );

    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenant2.rows[0].id, 'Josephine Wa Tanzania', 'manager@jengaplus.com', passwordManager, 'Manager', 'ATC-2026-3103', true]
    );

    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenant2.rows[0].id, 'Patrick Driver', 'driver@jengaplus.com', passwordDriver, 'Driver', 'ATC-2026-6112', true]
    );

    const superAdminHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, admission = EXCLUDED.admission, is_verified = EXCLUDED.is_verified, tenant_id = EXCLUDED.tenant_id`,
      [null, SUPERADMIN_NAME, SUPERADMIN_EMAIL, superAdminHash, 'SuperAdmin', SUPERADMIN_ADMISSION, true]
    );

    console.log("✅ All Database tables dropped, recreated, and synchronized successfully from scratch on Neon!");
  } catch (err) {
    console.error("❌ Error resetting database schema:", err);
  }
};

// --- API ROUTES ---

// 1. AUTHENTICATION API
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authorization token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const normalizeRole = (r) => (r || '').toString().trim().toLowerCase();
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const userRole = normalizeRole(req.user.role);
  const allowed = roles.map(normalizeRole);
  if (!allowed.includes(userRole)) {
    return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
  }
  next();
};

const recordAudit = async ({ tenantId = null, userId = null, action, entity, details = {} }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity, details) VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, userId, action, entity, JSON.stringify(details)]
    );
  } catch (auditErr) {
    console.warn('Audit log failed:', auditErr.message);
  }
};

// All business API routes require JWT by default. Authentication and the
// phone-protected receipt route remain public by design.
const PUBLIC_API_PATHS = new Set([
  '/auth/register',
  '/auth/login',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/biometric'
]);

app.use('/api', (req, res, next) => {
  const isPublicAuth = PUBLIC_API_PATHS.has(req.path);
  const isReceiptRoute = req.path.startsWith('/orders/') && req.path.endsWith('/receipt');
  if (isPublicAuth || isReceiptRoute) return next();

  authenticateToken(req, res, () => {
    const role = normalizeRole(req.user?.role);
    const isSuperAdmin = role === 'superadmin';
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const suppliedTenant = body?.tenant_id ?? body?.tenantId ?? req.query?.tenantId;

    if (!isSuperAdmin && suppliedTenant != null && String(suppliedTenant) !== String(req.user.tenant_id)) {
      return res.status(403).json({ error: 'Forbidden: tenant scope does not match authenticated user' });
    }

    // For tenant users, the server is the source of truth for tenant scope.
    // This prevents clients from selecting another tenant by editing JSON.
    if (!isSuperAdmin && body && req.user?.tenant_id != null) {
      if (Object.prototype.hasOwnProperty.call(body, 'tenant_id')) body.tenant_id = req.user.tenant_id;
      if (Object.prototype.hasOwnProperty.call(body, 'tenantId')) body.tenantId = req.user.tenant_id;
      if (!Object.prototype.hasOwnProperty.call(body, 'tenant_id')) body.tenant_id = req.user.tenant_id;
    }

    next();
  });
});

// Validate explicit tenant path parameters after Express resolves the route.
app.param('tenantId', (req, res, next, tenantId) => {
  const role = normalizeRole(req.user?.role);
  if (role !== 'superadmin' && String(tenantId) !== String(req.user?.tenant_id)) {
    return res.status(403).json({ error: 'Forbidden: tenant scope does not match authenticated user' });
  }
  next();
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: '🚀 JengaPlus SaaS Master Backend API is running successfully' });
});

// TENANT API
app.get('/api/tenants', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tenants', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  const { business_name, subdomain, subscription_status } = req.body;
  try {
    const tenant = await pool.query(
      'INSERT INTO tenants (business_name, subdomain, subscription_status) VALUES ($1, $2, $3) RETURNING *',
      [business_name, subdomain, subscription_status || 'Active']
    );
    await recordAudit({ tenantId: tenant.rows[0].id, userId: req.user.id, action: 'create_tenant', entity: 'tenant', details: { business_name, subdomain, subscription_status: subscription_status || 'Active' } });
    res.json({ message: 'Tenant created successfully', tenant: tenant.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/tenants', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, business_name, subdomain, subscription_status, created_at FROM tenants ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/tenants/:tenantId/status', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  const { tenantId } = req.params;
  const { subscription_status } = req.body;
  if (!subscription_status) return res.status(400).json({ error: 'subscription_status is required' });
  const allowed = ['Active', 'Suspended', 'Inactive'];
  if (!allowed.includes(subscription_status)) return res.status(400).json({ error: `subscription_status must be one of ${allowed.join(', ')}` });
  try {
    const updated = await pool.query(
      'UPDATE tenants SET subscription_status = $1 WHERE id = $2 RETURNING *',
      [subscription_status, tenantId]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    await recordAudit({ tenantId: updated.rows[0].id, userId: req.user.id, action: 'update_tenant_status', entity: 'tenant', details: { subscription_status } });
    res.json({ message: 'Tenant status updated', tenant: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { business_name, subdomain, name, email, password, role, phone } = req.body;
  if (!business_name || !subdomain || !name || !email || !password) {
    return res.status(400).json({ error: 'Business name, subdomain, name, email and password are required' });
  }

  // Validate the requested role before creating a tenant, otherwise an invalid
  // registration could leave an orphan tenant behind.
  const allowedRoles = ['boss', 'salesperson', 'driver'];
  const normalized = role ? role.toString().trim().toLowerCase() : 'boss';
  if (['admin', 'superadmin'].includes(normalized)) {
    return res.status(400).json({ error: 'Cannot create Admin or SuperAdmin through the public registration flow.' });
  }
  if (!allowedRoles.includes(normalized)) {
    return res.status(400).json({ error: 'Invalid role for registration. Only Boss, Salesperson, and Driver are allowed.' });
  }
  const userRole = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  try {
    const existingTenant = await pool.query('SELECT id FROM tenants WHERE subdomain = $1', [subdomain]);
    if (existingTenant.rows.length > 0) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }
    const tenant = await pool.query(
      'INSERT INTO tenants (business_name, subdomain, subscription_status) VALUES ($1, $2, $3) RETURNING *',
      [business_name, subdomain, 'Active']
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const admission = `ADM-${Date.now()}`;

    const user = await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenant.rows[0].id, name, email, passwordHash, userRole, admission, true]
    );

    const createdUser = user.rows[0];
    const publicUser = {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      tenant_id: createdUser.tenant_id,
      admission: createdUser.admission,
      is_verified: createdUser.is_verified,
    };
    const token = generateToken(createdUser);
    res.json({ message: 'Registration successful', user: publicUser, token });

    (async () => {
      try {
        await smsService.sendRegistrationSMS(phone || process.env.ADMIN_PHONE, business_name, name, subdomain);
      } catch (smsErr) {
        console.error('Failed to send registration SMS:', smsErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.tenant_id) {
      const tenantStatus = await pool.query('SELECT subscription_status FROM tenants WHERE id = $1', [user.tenant_id]);
      if (tenantStatus.rows.length && tenantStatus.rows[0].subscription_status === 'Suspended') {
        return res.status(403).json({ error: 'Tenant account is suspended. Contact SuperAdmin to reactivate.' });
      }
    }
    const token = generateToken(user);
    const tenantResult = user.tenant_id ? await pool.query('SELECT business_name FROM tenants WHERE id = $1', [user.tenant_id]) : null;
    res.json({ message: 'Login successful', token, user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      admission: user.admission,
      tenant_name: tenantResult?.rows[0]?.business_name || null
    }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.tenant_id, u.admission, u.is_verified, t.business_name AS tenant_name
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(userResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);
    await pool.query('UPDATE users SET otp_code = $1, otp_expires = $2 WHERE id = $3', [otp, expiresAt, userResult.rows[0].id]);
    const response = { message: 'OTP generated successfully' };
    if (DEMO_AUTH_RESPONSES) response.otp = otp;
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp_code } = req.body;
  try {
    const userResult = await pool.query('SELECT otp_code, otp_expires FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    if (!user.otp_code || user.otp_code !== otp_code || new Date() > new Date(user.otp_expires)) {
      return res.status(400).json({ error: 'Invalid or expired OTP code' });
    }
    await pool.query('UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE email = $1', [email]);
    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const resetToken = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000);
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [resetToken, expiresAt, userResult.rows[0].id]);
    const response = { message: 'Password reset token generated' };
    if (DEMO_AUTH_RESPONSES) response.reset_token = resetToken;
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, reset_token, new_password } = req.body;
  try {
    const userResult = await pool.query('SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    if (!user.reset_token || user.reset_token !== reset_token || new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    const passwordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [passwordHash, user.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/biometric', async (req, res) => {
  res.status(501).json({ error: 'Biometric login is not configured yet' });
});

app.get('/api/users/:tenantId', authenticateToken, authorizeRoles('SuperAdmin', 'Boss'), async (req, res) => {
  const { tenantId } = req.params;
  try {
    if (req.user.role === 'SuperAdmin') {
      const users = await pool.query('SELECT id, tenant_id, name, email, role, admission, is_verified FROM users ORDER BY created_at DESC');
      return res.json(users.rows);
    }
    const users = await pool.query('SELECT id, tenant_id, name, email, role, admission, is_verified FROM users WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, authorizeRoles('SuperAdmin', 'Boss'), async (req, res) => {
  const { tenant_id, name, email, password, role, phone } = req.body;
  if (!tenant_id || !name || !email || !password || !role) {
    return res.status(400).json({ error: 'Tenant ID, name, email, password and role are required' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, admission, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, tenant_id, name, email, role, admission, is_verified`,
      [tenant_id, name, email, passwordHash, role, `ADM-${Date.now()}`, true]
    );
    await recordAudit({ tenantId: tenant_id, userId: req.user.id, action: 'create_user', entity: 'user', details: { created_user_id: user.rows[0].id, name, email, role } });
    res.json({ message: 'User created successfully', user: user.rows[0] });

    (async () => {
      try {
        await smsService.sendStaffWelcomeSMS(phone || process.env.ADMIN_PHONE);
      } catch (smsErr) {
        console.error('Failed to send staff welcome SMS:', smsErr.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:userId', authenticateToken, authorizeRoles('SuperAdmin', 'Boss'), async (req, res) => {
  const { userId } = req.params;
  const { tenant_id, name, email, password, role } = req.body;

  if (!tenant_id || !name || !email || !role) {
    return res.status(400).json({ error: 'Tenant ID, name, email and role are required' });
  }

  if (req.user.role !== 'SuperAdmin' && req.user.tenant_id !== tenant_id) {
    return res.status(403).json({ error: 'Forbidden: cannot update users outside your tenant' });
  }

  try {
    let query = `UPDATE users SET name = $1, email = $2, role = $3`;
    const values = [name, email, role];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += `, password_hash = $4 WHERE id = $5 AND tenant_id = $6 RETURNING id, tenant_id, name, email, role, admission, is_verified`;
      values.push(passwordHash, userId, tenant_id);
    } else {
      query += ` WHERE id = $4 AND tenant_id = $5 RETURNING id, tenant_id, name, email, role, admission, is_verified`;
      values.push(userId, tenant_id);
    }

    const updatedUser = await pool.query(query, values);
    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or tenant mismatch' });
    }
    await recordAudit({ tenantId: tenant_id, userId: req.user.id, action: 'update_user', entity: 'user', details: { updated_user_id: updatedUser.rows[0].id, name, email, role } });
    res.json({ message: 'User updated successfully', user: updatedUser.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:userId', authenticateToken, authorizeRoles('SuperAdmin', 'Boss'), async (req, res) => {
  const { userId } = req.params;
  const { tenant_id } = req.body;

  if (!tenant_id) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  if (req.user.role !== 'SuperAdmin' && req.user.tenant_id !== tenant_id) {
    return res.status(403).json({ error: 'Forbidden: cannot delete users outside your tenant' });
  }

  try {
    const deletedUser = await pool.query(
      'DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id, tenant_id, name, email, role, admission, is_verified',
      [userId, tenant_id]
    );
    if (deletedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or tenant mismatch' });
    }
    await recordAudit({ tenantId: tenant_id, userId: req.user.id, action: 'delete_user', entity: 'user', details: { deleted_user_id: deletedUser.rows[0].id, email: deletedUser.rows[0].email, role: deletedUser.rows[0].role } });
    res.json({ message: 'User deleted successfully', user: deletedUser.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. INVENTORY API
app.get('/api/products/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const products = await pool.query('SELECT * FROM products WHERE tenant_id = $1', [tenantId]);
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { tenant_id, category, name, sku, barcode, unit, price, stock_quantity } = req.body;
  try {
    const newProduct = await pool.query(
      'INSERT INTO products (tenant_id, category, name, sku, barcode, unit, price, stock_quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [tenant_id, category, name, sku || null, barcode || null, unit, price, stock_quantity]
    );
    await recordAudit({ tenantId: tenant_id, userId: req.user?.id || null, action: 'create_product', entity: 'product', details: { product_id: newProduct.rows[0].id, name, sku, barcode } });
    res.json({ message: 'Product added successfully', product: newProduct.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:productId', async (req, res) => {
  const { productId } = req.params;
  const { tenant_id, category, name, sku, barcode, unit, price, stock_quantity, low_stock_threshold } = req.body;
  try {
    const updatedProduct = await pool.query(
      `UPDATE products SET category = $1, name = $2, sku = $3, barcode = $4, unit = $5, price = $6, stock_quantity = $7, low_stock_threshold = $8
       WHERE id = $9 AND tenant_id = $10 RETURNING *`,
      [category, name, sku || null, barcode || null, unit, price, stock_quantity, low_stock_threshold, productId, tenant_id]
    );
    if (updatedProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or tenant mismatch' });
    }
    await recordAudit({ tenantId: tenant_id, userId: req.user?.id || null, action: 'update_product', entity: 'product', details: { product_id: updatedProduct.rows[0].id, name, sku, barcode } });
    res.json({ message: 'Product updated successfully', product: updatedProduct.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:productId', async (req, res) => {
  const { productId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedProduct = await pool.query(
      'DELETE FROM products WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [productId, tenant_id]
    );
    if (deletedProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or tenant mismatch' });
    }
    await recordAudit({ tenantId: tenant_id, userId: req.user?.id || null, action: 'delete_product', entity: 'product', details: { product_id: deletedProduct.rows[0].id, name: deletedProduct.rows[0].name } });
    res.json({ message: 'Product deleted successfully', product: deletedProduct.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lookup product by barcode or sku
app.get('/api/products/scan/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const q = `SELECT * FROM products WHERE barcode = $1 OR sku = $1 LIMIT 1`;
    const result = await pool.query(q, [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. SALES & POS API
app.get('/api/sales/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const sales = await pool.query(
      `SELECT s.*, u.name AS salesperson_name, c.name AS customer_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.salesperson_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.tenant_id = $1 ORDER BY s.created_at DESC`,
      [tenantId]
    );
    res.json(sales.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sales/:tenantId/:saleId', async (req, res) => {
  const { tenantId, saleId } = req.params;
  try {
    const sale = await pool.query(
      `SELECT * FROM sales WHERE tenant_id = $1 AND id = $2`,
      [tenantId, saleId]
    );
    if (sale.rows.length === 0) return res.status(404).json({ error: 'Sale not found' });
    const items = await pool.query('SELECT * FROM sales_items WHERE sale_id = $1', [saleId]);
    res.json({ sale: sale.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sales', authenticateToken, authorizeRoles('Salesperson', 'Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  const { tenant_id, salesperson_id, customer_id, customer_name, invoice_number, discount_amount, tax_amount, total_amount, payment_method, payment_status, due_date, notes, line_items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertSale = await client.query(
      `INSERT INTO sales (tenant_id, salesperson_id, customer_id, invoice_number, customer_name, total_amount, discount_amount, tax_amount, payment_method, payment_status, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [tenant_id, salesperson_id, customer_id, invoice_number, customer_name, total_amount, discount_amount || 0, tax_amount || 0, payment_method, payment_status || 'Paid', due_date, notes]
    );

    const saleId = insertSale.rows[0].id;

    // If there are line items, check stock and insert items while deducting stock in a transaction
    if (Array.isArray(line_items) && line_items.length > 0) {
      for (const item of line_items) {
        const productId = item.product_id;
        const qty = Number(item.quantity) || 0;
        if (!productId) continue;

        // lock product row
        const prodRes = await client.query('SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE', [productId]);
        if (prodRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Product not found: ${productId}` });
        }
        const available = Number(prodRes.rows[0].stock_quantity || 0);
        if (available < qty) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Stock is insufficient for this item: product ${productId}` });
        }

        // deduct stock
        await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [qty, productId]);

        // insert sales_item
        await client.query(
          `INSERT INTO sales_items (tenant_id, sale_id, product_id, quantity, unit_price, discount, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenant_id, saleId, productId, qty, item.unit_price, item.discount || 0, item.line_total]
        );
      }

      // mark stock deducted on sale
      await client.query('UPDATE sales SET stock_deducted = TRUE WHERE id = $1', [saleId]);
    }

    await client.query('COMMIT');

    // Fetch inserted sale for response
    const sale = insertSale.rows[0];

    // send SMS asynchronously (same logic as before)
    (async () => {
      try {
        let phone = null;
        if (customer_id) {
          const custRes = await pool.query('SELECT phone FROM customers WHERE id = $1', [customer_id]);
          if (custRes.rows[0] && custRes.rows[0].phone) phone = custRes.rows[0].phone;
        }
        if (!phone) phone = process.env.ADMIN_PHONE;
        if (!phone) {
          console.log('No phone number available for order SMS (customer or ADMIN_PHONE)');
          return;
        }

        // Build item details either from provided line_items or from sales_items table
        let itemsDetails = [];
        if (Array.isArray(line_items) && line_items.length > 0) {
          const productIds = line_items.map((it) => it.product_id).filter(Boolean);
          if (productIds.length > 0) {
            const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
            const prodRes = await pool.query(`SELECT id, name FROM products WHERE id IN (${placeholders})`, productIds);
            const prodMap = new Map(prodRes.rows.map((p) => [p.id, p.name]));
            itemsDetails = line_items.map((it) => ({ name: prodMap.get(it.product_id) || 'Item', quantity: it.quantity || 1 }));
          } else {
            itemsDetails = line_items.map((it) => ({ name: it.name || 'Item', quantity: it.quantity || 1 }));
          }
        } else {
          const itemsRes = await pool.query(
            `SELECT si.quantity, p.name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
            [saleId]
          );
          itemsDetails = itemsRes.rows.map((r) => ({ name: r.name || 'Item', quantity: r.quantity || 1 }));
        }

        let itemsDescription = '';
        if (itemsDetails.length === 1) {
          itemsDescription = `${itemsDetails[0].name} (x${itemsDetails[0].quantity})`;
        } else if (itemsDetails.length > 1) {
          itemsDescription = itemsDetails.map((it) => `${it.name} (x${it.quantity})`).join(', ');
        }

        const to = String(phone).trim();
        await smsService.sendNewOrderSMS(to, invoice_number || saleId, itemsDescription);
        console.log('Order SMS sent to', to);
      } catch (smsErr) {
        console.error('Failed to send order SMS:', smsErr.message);
      }
    })();

    res.json({ message: 'Sale recorded successfully', sale });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update order status and optionally attach driver info
app.patch('/api/orders/:id/status', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  const { id } = req.params;
  const { status, driverName, driverPhone } = req.body;
  const allowed = ['Pending', 'Paid', 'Processing', 'Out for Delivery', 'Delivered'];
  if (!status || !allowed.includes(status)) return res.status(400).json({ error: 'Invalid or missing status' });

  try {
    // Update with driver info if provided (only for Out for Delivery)
    if (status === 'Out for Delivery') {
      await pool.query(
        `UPDATE sales SET order_status = $1, driver_name = $2, driver_phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
        [status, driverName || null, driverPhone || null, id]
      );
    } else {
      await pool.query(`UPDATE sales SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`, [status, id]);
    }

    const saleRes = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);
    if (saleRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const sale = saleRes.rows[0];

    // Build item list for message
    const itemsRes = await pool.query(
      `SELECT si.quantity, p.name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
      [id]
    );
    const items = itemsRes.rows.map((r) => ({ name: r.name || 'Item', quantity: r.quantity || 1 }));
    let itemPart = '';
    if (items.length === 1) itemPart = `${items[0].name}`;
    else if (items.length > 1) itemPart = items.map((it) => `${it.name} (x${it.quantity})`).join(', ');

    // Get customer phone
    let phone = null;
    if (sale.customer_id) {
      const custRes = await pool.query('SELECT phone FROM customers WHERE id = $1', [sale.customer_id]);
      if (custRes.rows[0] && custRes.rows[0].phone) phone = custRes.rows[0].phone;
    }

    // Compose message based on status
    let message = null;
    if (status === 'Out for Delivery') {
      message = `JENGA PLUS: Habari! Oda yako ya ${itemPart || ('#' + id)} iko njiani kuletwa site. Dereva: ${driverName || '---'} (${driverPhone || '---'}).`;
    } else if (status === 'Delivered') {
      message = `JENGA PLUS: Oda yako ya ${itemPart || ('#' + id)} imewasilishwa kwa mafanikio. Asante kwa kununua na UniMessage!`;
    } else {
      // For other statuses, send a generic update
      message = `JENGA PLUS: Hali ya Oda yako #${id} imebadilika kuwa '${status}'. Tazama akaunti yako kwa maelezo zaidi.`;
    }

    // Send SMS if phone available
    if (phone) {
      (async () => {
        try {
          await smsService.sendSMS(String(phone).trim(), message, 'UniMessage');
          console.log('Status update SMS sent to', phone);
        } catch (smsErr) {
          console.error('Failed to send status SMS:', smsErr.message);
        }
      })();
    } else {
      console.log('No customer phone available to send status SMS for order', id);
    }

    res.json({ message: 'Order status updated', order: sale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download/stream invoice PDF for an order
app.get('/api/orders/:id/receipt', async (req, res) => {
  const { id } = req.params;
  const phoneQuery = req.query.phone ? String(req.query.phone).trim() : null;

  try {
    const saleRes = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);
    if (saleRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const sale = saleRes.rows[0];

    // Determine permission: allow staff by JWT role OR allow customer by matching phone query
    let permitted = false;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        if (['Salesperson','Manager','Boss','SuperAdmin','Foreman'].includes(req.user.role)) permitted = true;
        // allow tenant match as well
        if (req.user.tenant_id && req.user.tenant_id === sale.tenant_id) permitted = permitted || true;
      } catch (e) {
        // ignore token errors
      }
    }

    // If not permitted by JWT, allow if phone query matches customer phone
    if (!permitted && phoneQuery) {
      const custRes = await pool.query('SELECT * FROM customers WHERE id = $1', [sale.customer_id]);
      if (custRes.rows.length && custRes.rows[0].phone) {
        const custPhone = String(custRes.rows[0].phone).trim();
        if (custPhone === phoneQuery) permitted = true;
      }
    }

    if (!permitted) return res.status(403).json({ error: 'Forbidden: not authorized to download this receipt' });

    const itemsRes = await pool.query('SELECT si.quantity, si.unit_price, si.line_total, p.name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1', [id]);
    const items = itemsRes.rows.map(r => ({ name: r.name, quantity: r.quantity, unit_price: r.unit_price, line_total: r.line_total }));
    let customer = {};
    if (sale.customer_id) {
      const cr = await pool.query('SELECT * FROM customers WHERE id = $1', [sale.customer_id]);
      if (cr.rows.length) customer = cr.rows[0];
    }

    // Stream PDF
    streamInvoicePDF(res, sale, items, customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sales/:saleId/refund', async (req, res) => {
  const { saleId } = req.params;
  const { tenant_id, refund_amount, reason } = req.body;
  try {
    const refund = await pool.query(
      `INSERT INTO refunds (tenant_id, sale_id, refund_amount, reason) VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenant_id, saleId, refund_amount, reason]
    );
    res.json({ message: 'Refund recorded successfully', refund: refund.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mock Payment Checkout - simulate mobile money payment (M-Pesa, Tigo Pesa, Airtel Money)
app.post('/api/payments/mock-checkout', async (req, res) => {
  const { orderId, phoneNumber, network, amount } = req.body;
  if (!orderId || !network || !amount) return res.status(400).json({ error: 'orderId, network and amount are required' });
  // default to ADMIN_PHONE from env if phoneNumber not provided
  const toPhone = phoneNumber ? String(phoneNumber).trim() : process.env.ADMIN_PHONE || null;
  if (!toPhone) return res.status(400).json({ error: 'phoneNumber is required or ADMIN_PHONE must be configured in .env' });

  try {
    // simulate customer entering PIN / processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Perform transactional stock check and payment update
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [orderId]);
      if (saleRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }
      const sale = saleRes.rows[0];

      // If stock already deducted, just mark Paid; otherwise check and deduct
      if (!sale.stock_deducted) {
        const itemsRes = await client.query('SELECT product_id, quantity FROM sales_items WHERE sale_id = $1', [orderId]);
        for (const r of itemsRes.rows) {
          const productId = r.product_id;
          const qty = Number(r.quantity || 0);
          const prodRes = await client.query('SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE', [productId]);
          if (prodRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Product not found: ${productId}` });
          }
          const available = Number(prodRes.rows[0].stock_quantity || 0);
          if (available < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Stock is insufficient for this item: product ${productId}` });
          }
          await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [qty, productId]);
        }
        // mark stock deducted
        await client.query('UPDATE sales SET stock_deducted = TRUE WHERE id = $1', [orderId]);
      }

      // Update sale payment status to Paid
      await client.query('UPDATE sales SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['Paid', orderId]);

      // Insert a customer payment record if possible
      try {
        const tenant_id = sale.tenant_id || null;
        const customer_id = sale.customer_id || null;
        await client.query(
          `INSERT INTO customer_payments (tenant_id, customer_id, debt_id, amount, payment_method, notes, paid_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [tenant_id, customer_id, null, amount, network, `Mock payment via ${network}`]
        );
      } catch (logErr) {
        console.error('Failed to record customer payment:', logErr.message);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      client.release();
      return res.status(500).json({ error: txErr.message });
    }
    client.release();

    // Generate PDF receipt and save to backend/receipts
    (async () => {
      try {
        const itemsRes2 = await pool.query(
          `SELECT si.quantity, si.unit_price, si.line_total, p.name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
          [orderId]
        );
        const items2 = itemsRes2.rows.map((r) => ({ name: r.name || 'Item', quantity: r.quantity || 1, unit_price: r.unit_price, line_total: r.line_total }));
        const cust = sale.customer_id ? (await pool.query('SELECT * FROM customers WHERE id = $1', [sale.customer_id])).rows[0] : {};
        const receiptsDir = require('path').join(__dirname, '..', 'receipts');
        const receiptPath = require('path').join(receiptsDir, `invoice-${sale.id}.pdf`);
        const { createInvoicePDFFile } = require('./services/pdfService');
        try { await createInvoicePDFFile(sale, items2, cust || {}, receiptPath); console.log('Saved receipt to', receiptPath); } catch (pdfErr) { console.error('Failed to create PDF receipt:', pdfErr.message); }
      } catch (e) {
        console.error('Error generating receipt in background:', e.message);
      }
    })();

    // Send SMS notification to customer using the phoneNumber (or ADMIN_PHONE)
    (async () => {
      try {
        // fetch items for this sale to build a dynamic message
        const itemsRes = await pool.query(
          `SELECT si.quantity, p.name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
          [orderId]
        );
        const items = itemsRes.rows.map((r) => ({ name: r.name || 'Item', quantity: r.quantity || 1 }));

        let itemPart = '';
        if (items.length === 1) {
          itemPart = `${items[0].name}`;
        } else if (items.length > 1) {
          itemPart = items.map((it) => `${it.name} (x${it.quantity})`).join(', ');
        }

        const to = toPhone;
        const itemText = itemPart || '';
        await smsService.sendPaymentConfirmationSMS(to, orderId, amount, network, itemText);
        console.log('Mock payment SMS sent to', to);
      } catch (smsErr) {
        console.error('Failed to send mock payment SMS:', smsErr.message);
      }
    })();

    res.json({ message: 'Payment simulated and order marked as Paid', orderId, amount, network });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const vehicles = await pool.query('SELECT * FROM vehicles WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    res.json(vehicles.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  const { tenant_id, plate, type, capacity, status, assigned_driver_id } = req.body;
  try {
    const vehicle = await pool.query(
      `INSERT INTO vehicles (tenant_id, plate, type, capacity, status, assigned_driver_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenant_id, plate, type, capacity, status || 'Active', assigned_driver_id]
    );
    res.json({ message: 'Vehicle registered successfully', vehicle: vehicle.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  const { tenant_id, plate, type, capacity, status, assigned_driver_id } = req.body;
  try {
    const updatedVehicle = await pool.query(
      `UPDATE vehicles SET plate = $1, type = $2, capacity = $3, status = $4, assigned_driver_id = $5
       WHERE id = $6 AND tenant_id = $7 RETURNING *`,
      [plate, type, capacity, status, assigned_driver_id, vehicleId, tenant_id]
    );
    if (updatedVehicle.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or tenant mismatch' });
    }
    res.json({ message: 'Vehicle updated successfully', vehicle: updatedVehicle.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get low-stock inventory items
app.get('/api/inventory/low-stock', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const threshold = req.query.threshold ? Number(req.query.threshold) : null;
    let rows;
    if (threshold !== null && !isNaN(threshold)) {
      const result = await pool.query('SELECT * FROM products WHERE stock_quantity <= $1 ORDER BY stock_quantity ASC', [threshold]);
      rows = result.rows;
    } else {
      const result = await pool.query('SELECT * FROM products WHERE stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC');
      rows = result.rows;
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate restock drafts for low-stock items (simple helper for frontend)
app.get('/api/inventory/restock-drafts', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
    const drafts = await inventoryService.generateRestockDrafts(tenantId, threshold);
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a restock alert (placeholder) - can be expanded to send SMS/email to supplier
app.post('/api/alerts/restock', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const { tenant_id, items } = req.body;
    // items: [{ product_id, suggested_reorder }]
    // Placeholder: persist alert or send notification via SMS service
    // For now return a draft acknowledgement
    // If supplier phone provided in body, attempt to notify
    const supplierPhone = req.body.supplierPhone || process.env.ADMIN_PHONE;
    if (supplierPhone && items && items.length > 0) {
      try {
        const textItems = items.map((it) => `${it.name || it.product_id} x ${it.suggested_reorder || ''}`).join(', ');
        await smsService.sendSMS(supplierPhone, `Restock request: ${textItems}`);
      } catch (smsErr) {
        console.error('Failed to send restock SMS:', smsErr.message);
      }
    }
    res.json({ message: 'Restock alert created', tenant_id: tenant_id || req.user.tenant_id, items: items || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a restock check for a tenant: returns drafts and optionally notifies supplier/admin via SMS
app.post('/api/inventory/run-restock-check', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.user.tenant_id;
    const threshold = req.body.threshold || undefined;
    const supplierPhone = req.body.supplierPhone || process.env.ADMIN_PHONE;
    const drafts = await inventoryService.generateRestockDrafts(tenantId, threshold);
    // If drafts exist and supplierPhone provided, send consolidated SMS
    if (drafts && drafts.length > 0 && supplierPhone) {
      const textItems = drafts.map((d) => `${d.name} x ${d.suggested_reorder}`).join(', ');
      try {
        await smsService.sendSMS(supplierPhone, `Restock drafts for tenant ${tenantId}: ${textItems}`);
      } catch (e) {
        console.error('SMS notify error', e.message || e);
      }
    }
    // Optionally create purchase orders when requested
    let createdPO = null;
    if (req.body.createPO) {
      try {
        createdPO = await inventoryService.createPurchaseOrdersFromDrafts(tenantId, drafts, req.body.supplier_id || null);
      } catch (e) {
        console.error('Create PO failed', e.message || e);
      }
    }
    res.json({ drafts, notified: Boolean(drafts && drafts.length > 0 && supplierPhone), purchase_order: createdPO });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import inventory CSV text payload (simpler than file-multipart). Expects CSV with header: category,name,unit,price,cost_price,stock_quantity,low_stock_threshold
app.post('/api/inventory/import-csv', authenticateToken, authorizeRoles('Boss','Manager','SuperAdmin'), async (req, res) => {
  const parseCsvLine = (line) => {
    const matches = line.match(/("([^"]*(?:""[^"]*)*)"|[^,]+)/g) || [];
    return matches.map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  };

  try {
    const { tenantId: tenantIdBody, csvText } = req.body;
    if (!csvText) return res.status(400).json({ error: 'csvText is required' });
    const tenantId = Number(tenantIdBody || req.user.tenant_id);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

    const text = String(csvText).replace(/^\uFEFF/, '').trim();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must contain header and at least one row' });
    if (lines.length > 350) return res.status(400).json({ error: 'CSV import is limited to 350 rows at a time for security and performance' });

    const header = parseCsvLine(lines.shift()).map((h) => h.toLowerCase());
    const requiredHeaders = ['category', 'name', 'unit', 'price', 'cost_price', 'stock_quantity', 'low_stock_threshold'];
    const missing = requiredHeaders.filter((h) => !header.includes(h));
    if (missing.length) return res.status(400).json({ error: `Missing required CSV headers: ${missing.join(', ')}` });

    const created = [];
    const updated = [];
    const errors = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < lines.length; index += 1) {
        const rowLine = lines[index];
        const cols = parseCsvLine(rowLine);
        const row = header.reduce((acc, key, idx) => ({ ...acc, [key]: (cols[idx] || '').trim() }), {});

        if (!row.name) {
          errors.push({ row: index + 2, reason: 'Missing product name' });
          continue;
        }

        const price = Number(row.price || 0);
        const cost_price = Number(row.cost_price || 0);
        const stock_quantity = parseInt(row.stock_quantity || '0', 10);
        const low_stock_threshold = parseInt(row.low_stock_threshold || '10', 10);

        if (Number.isNaN(price) || price < 0) {
          errors.push({ row: index + 2, reason: 'Invalid price value' });
          continue;
        }
        if (Number.isNaN(cost_price) || cost_price < 0) {
          errors.push({ row: index + 2, reason: 'Invalid cost_price value' });
          continue;
        }
        if (Number.isNaN(stock_quantity) || stock_quantity < 0) {
          errors.push({ row: index + 2, reason: 'Invalid stock_quantity value' });
          continue;
        }
        if (Number.isNaN(low_stock_threshold) || low_stock_threshold < 0) {
          errors.push({ row: index + 2, reason: 'Invalid low_stock_threshold value' });
          continue;
        }

        const category = row.category || 'General';
        const unit = row.unit || 'Piece';
        const sku = row.sku || null;
        const barcode = row.barcode || null;

        const existingRes = await client.query(
          `SELECT id FROM products WHERE tenant_id = $1 AND (LOWER(name) = LOWER($2) OR sku = $3 OR barcode = $4) LIMIT 1`,
          [tenantId, row.name, sku, barcode]
        );

        if (existingRes.rows.length > 0) {
          const productId = existingRes.rows[0].id;
          const updatedRes = await client.query(
            `UPDATE products SET category = $1, unit = $2, price = $3, cost_price = $4, stock_quantity = $5, low_stock_threshold = $6, sku = $7, barcode = $8 WHERE id = $9 AND tenant_id = $10 RETURNING *`,
            [category, unit, price, cost_price, stock_quantity, low_stock_threshold, sku, barcode, productId, tenantId]
          );
          updated.push({ row: index + 2, name: updatedRes.rows[0].name, action: 'updated' });
          continue;
        }

        const insertedRes = await client.query(
          `INSERT INTO products (tenant_id, category, name, sku, barcode, unit, price, cost_price, stock_quantity, low_stock_threshold)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [tenantId, category, row.name, sku, barcode, unit, price, cost_price, stock_quantity, low_stock_threshold]
        );
        created.push({ row: index + 2, name: insertedRes.rows[0].name, action: 'created' });
      }
      await client.query('COMMIT');
    } catch (importErr) {
      await client.query('ROLLBACK');
      throw importErr;
    } finally {
      client.release();
    }

    await recordAudit({ tenantId, userId: req.user.id, action: 'import_inventory_csv', entity: 'products', details: { created: created.length, updated: updated.length, errors: errors.length } });
    res.json({ message: 'Import complete', createdCount: created.length, updatedCount: updated.length, errors, created, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expose low-stock drafts as read-only (frontend polls this)
app.get('/api/inventory/low/:tenantId', authenticateToken, authorizeRoles('Boss','Manager','SuperAdmin','Salesperson'), async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.user.tenant_id;
    const threshold = req.query.threshold || undefined;
    const drafts = await inventoryService.generateRestockDrafts(tenantId, threshold);
    res.json({ drafts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cron-like endpoint: run restock check across all tenants and notify admin phone for each tenant
app.post('/api/inventory/schedule-run', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const tenantsRes = await pool.query('SELECT id, business_name FROM tenants');
    const results = [];
    for (const t of tenantsRes.rows) {
      try {
        const drafts = await inventoryService.generateRestockDrafts(t.id);
        let notified = false;
        if (drafts && drafts.length > 0 && process.env.ADMIN_PHONE) {
          const textItems = drafts.map((d) => `${d.name} x ${d.suggested_reorder}`).join(', ');
          await smsService.sendSMS(process.env.ADMIN_PHONE, `Tenant ${t.business_name} (${t.id}) restock: ${textItems}`);
          notified = true;
        }
        results.push({ tenantId: t.id, draftsCount: drafts.length, notified });
      } catch (e) {
        console.error('Tenant restock error', t.id, e.message || e);
        results.push({ tenantId: t.id, error: e.message || String(e) });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SuperAdmin overview: counts and quick health checks
app.get('/api/admin/overview', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const tenants = await pool.query('SELECT COUNT(*) FROM tenants');
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const products = await pool.query('SELECT COUNT(*) FROM products');
    const low = await pool.query('SELECT COUNT(*) FROM products WHERE stock_quantity::int <= COALESCE(low_stock_threshold::int, 10)');
    const suspended = await pool.query("SELECT COUNT(*) FROM tenants WHERE subscription_status = 'Suspended'");
    res.json({ tenants: Number(tenants.rows[0].count), users: Number(users.rows[0].count), products: Number(products.rows[0].count), low_stock: Number(low.rows[0].count), suspended_tenants: Number(suspended.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/audit-logs', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const logs = await pool.query(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 200`
    );
    res.json(logs.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Optional background scheduler: when ENABLE_RESTOCK_SCHEDULER=true, periodically run restock checks
if (process.env.ENABLE_RESTOCK_SCHEDULER === 'true') {
  const intervalMinutes = Number(process.env.RESTOCK_SCHEDULE_MINUTES || 60);
  console.log('Restock scheduler enabled. Running every', intervalMinutes, 'minutes');
  setInterval(async () => {
    try {
      const tenantsRes = await pool.query('SELECT id, business_name FROM tenants');
      for (const t of tenantsRes.rows) {
        try {
          const drafts = await inventoryService.generateRestockDrafts(t.id);
          if (drafts && drafts.length > 0 && process.env.ADMIN_PHONE) {
            const textItems = drafts.map((d) => `${d.name} x ${d.suggested_reorder}`).join(', ');
            await smsService.sendSMS(process.env.ADMIN_PHONE, `Auto restock: Tenant ${t.business_name} (${t.id}) - ${textItems}`);
          }
        } catch (e) {
          console.error('Scheduled restock error for tenant', t.id, e.message || e);
        }
      }
    } catch (err) {
      console.error('Scheduled restock master error', err.message || err);
    }
  }, Math.max(1000 * 60, intervalMinutes * 60 * 1000));
}

// Voice assistant command endpoint (placeholder)
app.post('/api/voice/command', authenticateToken, authorizeRoles('Boss'), async (req, res) => {
  try {
    const { command } = req.body;
    // Integrate with AI / STT in future. For now return a canned response.
    res.json({ command, response: 'Voice command received (scaffold). Integrate AI assistant separately.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LLM-assisted command endpoint: accepts text and routes to LLM if configured, otherwise returns canned response
app.post('/api/voice/ask', authenticateToken, authorizeRoles('Boss','Manager','SuperAdmin'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (process.env.OPENAI_API_KEY) {
      // Lightweight OpenAI call if key present
      const resp = await require('axios').post('https://api.openai.com/v1/chat/completions', {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: text }],
        max_tokens: 400
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
      const answer = resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message ? resp.data.choices[0].message.content : 'No answer';
      return res.json({ text, answer });
    }
    // Fallback canned
    return res.json({ text, answer: `Echo: ${text}. (No LLM key configured)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gamification endpoints
app.get('/api/gamification/badges/:userId', authenticateToken, authorizeRoles('Boss','Manager','SuperAdmin','Salesperson','Driver'), async (req, res) => {
  try {
    const { userId } = req.params;
    const badgesRes = await pool.query(
      `SELECT b.*, ub.awarded_at FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
       WHERE b.tenant_id = $2`,
      [userId, req.user.tenant_id]
    );
    res.json(badgesRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gamification/award', authenticateToken, authorizeRoles('Boss','Manager','SuperAdmin'), async (req, res) => {
  try {
    const { userId, badgeCode } = req.body;
    if (!userId || !badgeCode) return res.status(400).json({ error: 'userId and badgeCode are required' });
    // Ensure badge exists or create default
    let badge = await pool.query('SELECT * FROM badges WHERE tenant_id = $1 AND code = $2', [req.user.tenant_id, badgeCode]);
    if (!badge.rows.length) {
      badge = await pool.query('INSERT INTO badges (tenant_id, code, title, description, points) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.user.tenant_id, badgeCode, badgeCode, 'Awarded badge', 10]);
    }
    const badgeId = badge.rows[0].id;
    await pool.query('INSERT INTO user_badges (tenant_id, user_id, badge_id) VALUES ($1,$2,$3)', [req.user.tenant_id, userId, badgeId]);
    res.json({ message: 'Badge awarded', badge: badge.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: growth calculation for boss dashboard (monthly percent change)
app.get('/api/reports/growth', authenticateToken, authorizeRoles('Boss', 'Manager', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    // Sum of this month and previous month
    const monthsQ = `SELECT
      COALESCE(SUM(CASE WHEN date_trunc('month', created_at) = date_trunc('month', NOW()) THEN total_amount END),0) AS current_month,
      COALESCE(SUM(CASE WHEN date_trunc('month', created_at) = date_trunc('month', NOW() - INTERVAL '1 month') THEN total_amount END),0) AS prev_month
      FROM sales WHERE tenant_id = $1 AND payment_status = 'Paid'`;
    const r = await pool.query(monthsQ, [tenantId]);
    const cur = Number(r.rows[0].current_month || 0);
    const prev = Number(r.rows[0].prev_month || 0);
    let percent = 0;
    if (prev === 0 && cur > 0) percent = 100;
    else if (prev === 0 && cur === 0) percent = 0;
    else percent = ((cur - prev) / prev) * 100;
    res.json({ current_month: cur, previous_month: prev, percent_change: percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/sales-summary', authenticateToken, authorizeRoles('Boss','Manager','SuperAdmin','Salesperson'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const q = `SELECT
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN total_amount END),0) AS daily,
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 day' THEN total_amount END),0) AS weekly,
      COALESCE(SUM(CASE WHEN date_trunc('month', created_at) = date_trunc('month', NOW()) THEN total_amount END),0) AS monthly
      FROM sales WHERE tenant_id = $1 AND payment_status = 'Paid'`;
    const r = await pool.query(q, [tenantId]);
    res.json({ daily: Number(r.rows[0].daily || 0), weekly: Number(r.rows[0].weekly || 0), monthly: Number(r.rows[0].monthly || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Analytics APIs (Top Selling, Sales Trends, Inventory Summary)
app.get('/api/analytics/top-products', authenticateToken, authorizeRoles('Manager','Admin','Boss','SuperAdmin'), async (req, res) => {
  try {
    const { tenantId } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    const q = `SELECT p.id, p.name, SUM(si.quantity) AS total_sold, SUM(si.line_total) AS revenue
               FROM sales_items si
               JOIN products p ON p.id = si.product_id
               JOIN sales s ON s.id = si.sale_id
               ${tenantId ? 'WHERE s.tenant_id = $1' : ''}
               GROUP BY p.id, p.name
               ORDER BY total_sold DESC
               LIMIT $${tenantId ? '2' : '1'}`;
    const params = tenantId ? [tenantId, limit] : [limit];
    const rows = await pool.query(q, params);
    res.json(rows.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/sales-trends', authenticateToken, authorizeRoles('Manager','Admin','Boss','SuperAdmin'), async (req, res) => {
  try {
    const { tenantId, start, end, granularity } = req.query; // granularity: day|week|month
    const g = (granularity || 'day').toLowerCase();
    let dateTrunc = 'day';
    if (g === 'week') dateTrunc = 'week';
    if (g === 'month') dateTrunc = 'month';
    const params = [];
    let where = '';
    if (tenantId) { params.push(tenantId); where = `WHERE s.tenant_id = $${params.length}`; }
    if (start) { params.push(start); where += where ? ` AND s.created_at >= $${params.length}` : `WHERE s.created_at >= $${params.length}`; }
    if (end) { params.push(end); where += where ? ` AND s.created_at <= $${params.length}` : `WHERE s.created_at <= $${params.length}`; }

    const q = `SELECT date_trunc('${dateTrunc}', s.created_at) AS period, COUNT(*) AS orders_count, SUM(s.total_amount) AS total_sales
               FROM sales s
               ${where}
               GROUP BY period
               ORDER BY period`;
    const rows = await pool.query(q, params);
    res.json(rows.rows.map(r => ({ period: r.period, orders: parseInt(r.orders_count), total_sales: parseFloat(r.total_sales) || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/inventory-summary', authenticateToken, authorizeRoles('Manager','Admin','Boss','SuperAdmin','Salesperson','Cashier'), async (req, res) => {
  try {
    const { tenantId } = req.query;
    const params = [];
    let where = '';
    if (tenantId) { params.push(tenantId); where = `WHERE tenant_id = $1`; }
    const totalProducts = await pool.query(`SELECT COUNT(*) FROM products ${where}`, params);
    // low stock query needs proper WHERE/AND handling
    let lowStockQuery = 'SELECT COUNT(*) FROM products';
    let totalStockQuery = 'SELECT SUM(stock_quantity) FROM products';
    const lowParams = [];
    if (tenantId) {
      lowStockQuery += ' WHERE tenant_id = $1 AND stock_quantity <= low_stock_threshold';
      totalStockQuery += ' WHERE tenant_id = $1';
      lowParams.push(tenantId);
    } else {
      lowStockQuery += ' WHERE stock_quantity <= low_stock_threshold';
    }
    const lowStock = await pool.query(lowStockQuery, lowParams.length ? lowParams : undefined);
    const totalStock = await pool.query(totalStockQuery, lowParams.length ? lowParams : undefined);
    res.json({ total_products: parseInt(totalProducts.rows[0].count), low_stock_count: parseInt(lowStock.rows[0].count), total_stock_quantity: parseInt(totalStock.rows[0].sum) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: Top-selling products
app.get('/api/reports/top-products', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const limit = parseInt(req.query.limit, 10) || 10;
    const q = `
      SELECT p.id, p.name, COALESCE(SUM(si.quantity),0) AS total_quantity, COALESCE(SUM(si.line_total),0) AS total_sales
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1 AND s.payment_status = 'Paid'
      GROUP BY p.id, p.name
      ORDER BY total_quantity DESC
      LIMIT $2`;
    const result = await pool.query(q, [tenantId, limit]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reports: Profit insights
app.get('/api/reports/profit-insights', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const limit = parseInt(req.query.limit, 10) || 10;

    const perProductQ = `
      SELECT p.id, p.name,
        COALESCE(SUM(si.quantity),0) AS total_quantity,
        COALESCE(SUM(si.line_total),0) AS total_sales,
        COALESCE(SUM(p.cost_price * si.quantity),0) AS total_cost,
        COALESCE(SUM((si.unit_price - p.cost_price) * si.quantity),0) AS total_profit
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1 AND s.payment_status = 'Paid'
      GROUP BY p.id, p.name
      ORDER BY total_profit DESC
      LIMIT $2`;

    const overallQ = `
      SELECT
        COALESCE(SUM(si.line_total),0) AS gross_sales,
        COALESCE(SUM(p.cost_price * si.quantity),0) AS total_cost,
        COALESCE(SUM((si.unit_price - p.cost_price) * si.quantity),0) AS total_profit
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1 AND s.payment_status = 'Paid'`;

    const [perProductRes, overallRes] = await Promise.all([
      pool.query(perProductQ, [tenantId, limit]),
      pool.query(overallQ, [tenantId])
    ]);

    res.json({ products: perProductRes.rows, overall: overallRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV exports for reports
app.get('/api/reports/sales-summary.csv', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const dailyQ = `SELECT COALESCE(SUM(total_amount),0) AS daily FROM sales WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE AND payment_status = 'Paid'`;
    const weeklyQ = `SELECT COALESCE(SUM(total_amount),0) AS weekly FROM sales WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days' AND payment_status = 'Paid'`;
    const monthlyQ = `SELECT COALESCE(SUM(total_amount),0) AS monthly FROM sales WHERE tenant_id = $1 AND date_trunc('month', created_at) = date_trunc('month', now()) AND payment_status = 'Paid'`;
    const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
      pool.query(dailyQ, [tenantId]),
      pool.query(weeklyQ, [tenantId]),
      pool.query(monthlyQ, [tenantId])
    ]);

    const rows = [
      ['period','amount'],
      ['daily', dailyRes.rows[0].daily || 0],
      ['weekly', weeklyRes.rows[0].weekly || 0],
      ['monthly', monthlyRes.rows[0].monthly || 0]
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-summary.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/top-products.csv', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const limit = parseInt(req.query.limit, 10) || 1000;
    const q = `
      SELECT p.id, p.name, COALESCE(SUM(si.quantity),0) AS total_quantity, COALESCE(SUM(si.line_total),0) AS total_sales
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1 AND s.payment_status = 'Paid'
      GROUP BY p.id, p.name
      ORDER BY total_quantity DESC
      LIMIT $2`;
    const result = await pool.query(q, [tenantId, limit]);
    const header = ['product_id','product_name','total_quantity','total_sales'];
    const lines = [header.join(',')].concat(result.rows.map(r => [r.id, r.name.replace(/,/g,' '), r.total_quantity, r.total_sales].join(',')));
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="top-products.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/profit-insights.csv', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenant_id;
    const limit = parseInt(req.query.limit, 10) || 1000;
    const perProductQ = `
      SELECT p.id, p.name,
        COALESCE(SUM(si.quantity),0) AS total_quantity,
        COALESCE(SUM(si.line_total),0) AS total_sales,
        COALESCE(SUM(p.cost_price * si.quantity),0) AS total_cost,
        COALESCE(SUM((si.unit_price - p.cost_price) * si.quantity),0) AS total_profit
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1 AND s.payment_status = 'Paid'
      GROUP BY p.id, p.name
      ORDER BY total_profit DESC
      LIMIT $2`;
    const overallQ = `
      SELECT
        COALESCE(SUM(si.line_total),0) AS gross_sales,
        COALESCE(SUM(p.cost_price * si.quantity),0) AS total_cost,
        COALESCE(SUM((si.unit_price - p.cost_price) * si.quantity),0) AS total_profit
      FROM sales_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = $1 AND s.payment_status = 'Paid'`;
    const [perProductRes, overallRes] = await Promise.all([
      pool.query(perProductQ, [tenantId, limit]),
      pool.query(overallQ, [tenantId])
    ]);

    const header = ['product_id','product_name','total_quantity','total_sales','total_cost','total_profit'];
    const lines = [header.join(',')].concat(perProductRes.rows.map(r => [r.id, (r.name||'').replace(/,/g,' '), r.total_quantity, r.total_sales, r.total_cost, r.total_profit].join(',')));
    // add overall as a footer line
    lines.push('');
    lines.push(`gross_sales,${overallRes.rows[0].gross_sales || 0}`);
    lines.push(`total_cost,${overallRes.rows[0].total_cost || 0}`);
    lines.push(`total_profit,${overallRes.rows[0].total_profit || 0}`);

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="profit-insights.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedVehicle = await pool.query(
      'DELETE FROM vehicles WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [vehicleId, tenant_id]
    );
    if (deletedVehicle.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or tenant mismatch' });
    }
    res.json({ message: 'Vehicle deleted successfully', vehicle: deletedVehicle.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deliveries/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const deliveries = await pool.query(
      `SELECT d.*, u.name AS driver_name, v.plate AS vehicle_plate
       FROM deliveries d
       LEFT JOIN users u ON u.id = d.driver_id
       LEFT JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.tenant_id = $1 ORDER BY d.created_at DESC`,
      [tenantId]
    );
    res.json(deliveries.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deliveries', async (req, res) => {
  const { tenant_id, driver_id, vehicle_id, customer_name, customer_address, destination, status, route_start, route_end, distance_km, eta } = req.body;
  try {
    const delivery = await pool.query(
      `INSERT INTO deliveries (tenant_id, driver_id, vehicle_id, customer_name, customer_address, destination, status, route_start, route_end, distance_km, eta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [tenant_id, driver_id, vehicle_id, customer_name, customer_address, destination, status || 'Pending', route_start, route_end, distance_km || 0, eta]
    );
    res.json({ message: 'Delivery order created successfully', delivery: delivery.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deliveries/:deliveryId/gps', async (req, res) => {
  const { deliveryId } = req.params;
  const { tenant_id, latitude, longitude, speed_kmh } = req.body;
  try {
    const gpsLog = await pool.query(
      `INSERT INTO delivery_gps_logs (tenant_id, delivery_id, latitude, longitude, speed_kmh)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenant_id, deliveryId, latitude, longitude, speed_kmh]
    );
    res.json({ message: 'GPS log recorded successfully', gpsLog: gpsLog.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deliveries/:deliveryId/status', async (req, res) => {
  const { deliveryId } = req.params;
  const { tenant_id, status, proof_of_delivery_url, phoneNumber } = req.body;
  try {
    const updated = await pool.query(
      `UPDATE deliveries SET status = $1, proof_of_delivery_url = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [status, proof_of_delivery_url, deliveryId, tenant_id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });

    const delivery = updated.rows[0];
    const projectName = delivery.customer_name || delivery.destination || `Delivery ${deliveryId}`;

    (async () => {
      try {
        await smsService.sendDeliveryUpdateSMS(phoneNumber || process.env.ADMIN_PHONE, projectName);
      } catch (smsErr) {
        console.error('Failed to send delivery update SMS:', smsErr.message);
      }
    })();

    res.json({ message: 'Delivery status updated', delivery: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deliveries/:deliveryId', async (req, res) => {
  const { deliveryId } = req.params;
  const { tenant_id, driver_id, vehicle_id, customer_name, customer_address, destination, status, route_start, route_end, distance_km, eta } = req.body;
  try {
    const updated = await pool.query(
      `UPDATE deliveries SET driver_id = $1, vehicle_id = $2, customer_name = $3, customer_address = $4, destination = $5, status = $6, route_start = $7, route_end = $8, distance_km = $9, eta = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND tenant_id = $12 RETURNING *`,
      [driver_id, vehicle_id, customer_name, customer_address, destination, status, route_start, route_end, distance_km, eta, deliveryId, tenant_id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    res.json({ message: 'Delivery updated successfully', delivery: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/deliveries/:deliveryId', async (req, res) => {
  const { deliveryId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deleted = await pool.query('DELETE FROM deliveries WHERE id = $1 AND tenant_id = $2 RETURNING *', [deliveryId, tenant_id]);
    if (deleted.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    res.json({ message: 'Delivery deleted successfully', delivery: deleted.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deliveries/:tenantId/:deliveryId', async (req, res) => {
  const { tenantId, deliveryId } = req.params;
  try {
    const result = await pool.query(
      `SELECT d.*, u.name AS driver_name, v.plate AS vehicle_plate
       FROM deliveries d
       LEFT JOIN users u ON u.id = d.driver_id
       LEFT JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.tenant_id = $1 AND d.id = $2`,
      [tenantId, deliveryId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    const gpsLogs = await pool.query('SELECT * FROM delivery_gps_logs WHERE delivery_id = $1 ORDER BY recorded_at ASC', [deliveryId]);
    res.json({ delivery: result.rows[0], gps_logs: gpsLogs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles/:tenantId/:vehicleId', async (req, res) => {
  const { tenantId, vehicleId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM vehicles WHERE tenant_id = $1 AND id = $2', [tenantId, vehicleId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/refunds/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const refunds = await pool.query(
      `SELECT r.*, s.invoice_number, c.name AS customer_name
       FROM refunds r
       LEFT JOIN sales s ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE r.tenant_id = $1 ORDER BY r.refunded_at DESC`,
      [tenantId]
    );
    res.json(refunds.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const [customerCount, salesCount, deliveryCount, vehicleCount, lowStock, revenueData, expenseData, outstandingData] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM customers WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM sales WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM deliveries WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM vehicles WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COUNT(*) FROM products WHERE tenant_id = $1 AND stock_quantity <= low_stock_threshold', [tenantId]),
      pool.query('SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM sales WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE tenant_id = $1', [tenantId]),
      pool.query('SELECT COALESCE(SUM(outstanding_balance), 0) AS total_outstanding FROM customers WHERE tenant_id = $1', [tenantId])
    ]);

    res.json({
      total_customers: parseInt(customerCount.rows[0].count, 10),
      total_sales: parseInt(salesCount.rows[0].count, 10),
      total_deliveries: parseInt(deliveryCount.rows[0].count, 10),
      total_vehicles: parseInt(vehicleCount.rows[0].count, 10),
      low_stock_count: parseInt(lowStock.rows[0].count, 10),
      total_revenue: parseFloat(revenueData.rows[0].total_revenue || 0),
      total_expenses: parseFloat(expenseData.rows[0].total_expenses || 0),
      total_outstanding: parseFloat(outstandingData.rows[0].total_outstanding || 0),
      profit_loss: parseFloat(revenueData.rows[0].total_revenue || 0) - parseFloat(expenseData.rows[0].total_expenses || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. CUSTOMER MANAGEMENT API
app.get('/api/customers/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const customers = await pool.query('SELECT * FROM customers WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    res.json(customers.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CUSTOMER: debts, ledger, payments (placed before the customer detail route to avoid route param collision)
app.get('/api/customers/:tenantId/debts', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const debts = await pool.query(
      `SELECT d.*, c.name AS customer_name, c.phone AS customer_phone
       FROM customer_debts d
       JOIN customers c ON c.id = d.customer_id
       WHERE d.tenant_id = $1 AND d.status <> 'Paid'
       ORDER BY d.due_date ASC`,
      [tenantId]
    );
    res.json(debts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/:tenantId/ledger/:customerId', async (req, res) => {
  const { tenantId, customerId } = req.params;
  try {
    const debts = await pool.query(
      'SELECT * FROM customer_debts WHERE tenant_id = $1 AND customer_id = $2 ORDER BY created_at DESC',
      [tenantId, customerId]
    );
    const payments = await pool.query(
      'SELECT * FROM customer_payments WHERE tenant_id = $1 AND customer_id = $2 ORDER BY paid_at DESC',
      [tenantId, customerId]
    );
    res.json({ debts: debts.rows, payments: payments.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/:tenantId/payments', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const payments = await pool.query(
      `SELECT p.*, c.name AS customer_name FROM customer_payments p
       JOIN customers c ON c.id = p.customer_id
       WHERE p.tenant_id = $1 ORDER BY paid_at DESC`,
      [tenantId]
    );
    res.json(payments.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer detail route (specific customer by id)
app.get('/api/customers/:tenantId/:customerId', async (req, res) => {
  const { tenantId, customerId } = req.params;
  try {
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1 AND tenant_id = $2', [customerId, tenantId]);
    if (customer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { tenant_id, name, phone, address, category, credit_limit, loyalty_tier } = req.body;
  try {
    const newCustomer = await pool.query(
      `INSERT INTO customers (tenant_id, name, phone, address, category, credit_limit, loyalty_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenant_id, name, phone, address, category || 'Retail', credit_limit || 0, loyalty_tier || 'Bronze']
    );
    res.json({ message: 'Customer added successfully', customer: newCustomer.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const { tenant_id, name, phone, address, category, credit_limit, loyalty_points, loyalty_tier } = req.body;
  try {
    const updatedCustomer = await pool.query(
      `UPDATE customers SET name = $1, phone = $2, address = $3, category = $4, credit_limit = $5, loyalty_points = $6, loyalty_tier = $7
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [name, phone, address, category, credit_limit, loyalty_points, loyalty_tier, customerId, tenant_id]
    );
    if (updatedCustomer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or tenant mismatch' });
    }
    res.json({ message: 'Customer updated successfully', customer: updatedCustomer.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedCustomer = await pool.query('DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING *', [customerId, tenant_id]);
    if (deletedCustomer.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or tenant mismatch' });
    }
    res.json({ message: 'Customer removed successfully', customer: deletedCustomer.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/:customerId/debt', async (req, res) => {
  const { customerId } = req.params;
  const { tenant_id, sale_reference, amount, due_date } = req.body;
  try {
    const debtInsert = await pool.query(
      `INSERT INTO customer_debts (tenant_id, customer_id, sale_reference, amount, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenant_id, customerId, sale_reference, amount, due_date]
    );

    await pool.query(
      `UPDATE customers SET outstanding_balance = outstanding_balance + $1
       WHERE id = $2 AND tenant_id = $3`,
      [amount, customerId, tenant_id]
    );

    res.json({ message: 'Customer debt recorded successfully', debt: debtInsert.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/:customerId/payment', async (req, res) => {
  const { customerId } = req.params;
  const { tenant_id, debt_id, amount, payment_method, notes } = req.body;
  try {
    const paymentInsert = await pool.query(
      `INSERT INTO customer_payments (tenant_id, customer_id, debt_id, amount, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenant_id, customerId, debt_id || null, amount, payment_method || 'Cash', notes]
    );

    await pool.query(
      `UPDATE customers SET outstanding_balance = outstanding_balance - $1
       WHERE id = $2 AND tenant_id = $3`,
      [amount, customerId, tenant_id]
    );

    if (debt_id) {
      await pool.query(
        `UPDATE customer_debts SET amount = GREATEST(amount - $1, 0), status = CASE WHEN amount - $1 <= 0 THEN 'Paid' ELSE 'Partial' END
         WHERE id = $2 AND tenant_id = $3`,
        [amount, debt_id, tenant_id]
      );
    }

    res.json({ message: 'Payment applied successfully', payment: paymentInsert.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supplier & Procurement API
app.get('/api/suppliers/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const suppliers = await pool.query('SELECT * FROM suppliers WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    res.json(suppliers.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
  const { tenant_id, name, contact_person, phone, email, address, rating, notes } = req.body;
  try {
    const supplier = await pool.query(
      `INSERT INTO suppliers (tenant_id, name, contact_person, phone, email, address, rating, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenant_id, name, contact_person, phone, email, address, rating || 0, notes]
    );
    await recordAudit({ tenantId: tenant_id, userId: req.user?.id || null, action: 'create_supplier', entity: 'supplier', details: { supplier_id: supplier.rows[0].id, name, phone } });
    res.json({ message: 'Supplier created successfully', supplier: supplier.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/suppliers/:supplierId', async (req, res) => {
  const { supplierId } = req.params;
  const { tenant_id, name, contact_person, phone, email, address, rating, notes } = req.body;
  try {
    const updatedSupplier = await pool.query(
      `UPDATE suppliers SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5, rating = $6, notes = $7
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [name, contact_person, phone, email, address, rating || 0, notes, supplierId, tenant_id]
    );
    if (updatedSupplier.rows.length === 0) return res.status(404).json({ error: 'Supplier not found or tenant mismatch' });
    res.json({ message: 'Supplier updated successfully', supplier: updatedSupplier.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/suppliers/:supplierId', async (req, res) => {
  const { supplierId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedSupplier = await pool.query('DELETE FROM suppliers WHERE id = $1 AND tenant_id = $2 RETURNING *', [supplierId, tenant_id]);
    if (deletedSupplier.rows.length === 0) return res.status(404).json({ error: 'Supplier not found or tenant mismatch' });
    res.json({ message: 'Supplier deleted successfully', supplier: deletedSupplier.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/purchase-orders/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const orders = await pool.query(
      `SELECT po.*, s.name AS supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.tenant_id = $1 ORDER BY po.created_at DESC`,
      [tenantId]
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase-orders', authenticateToken, authorizeRoles('Manager', 'Boss', 'SuperAdmin'), async (req, res) => {
  const { tenant_id, supplier_id, order_number, status, total_amount, currency, expected_delivery_date, notes } = req.body;
  try {
    const order = await pool.query(
      `INSERT INTO purchase_orders (tenant_id, supplier_id, order_number, status, total_amount, currency, expected_delivery_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenant_id, supplier_id, order_number, status || 'Pending', total_amount || 0, currency || 'TZS', expected_delivery_date, notes]
    );
      // Send SMS to supplier or fallback to admin phone (non-blocking)
      (async () => {
        try {
          let phone = null;
          if (supplier_id) {
            const supRes = await pool.query('SELECT phone FROM suppliers WHERE id = $1', [supplier_id]);
            if (supRes.rows[0] && supRes.rows[0].phone) phone = supRes.rows[0].phone;
          }
          if (!phone) phone = process.env.ADMIN_PHONE;
          if (phone) {
            const orderId = order.rows[0].id;
            const message = `JENGA PLUS: Purchase order # ${orderId} imetekelezwa na imeandikwa kwenye mfumo.`;
            await smsService.sendSMS(phone, message);
            console.log('Purchase order SMS sent to', phone);
          } else {
            console.log('No phone number available for purchase order SMS (supplier or ADMIN_PHONE)');
          }
        } catch (smsErr) {
          console.error('Failed to send purchase order SMS:', smsErr.message);
        }
      })();

      res.json({ message: 'Purchase order created successfully', purchase_order: order.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase-orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { tenant_id, supplier_id, order_number, status, total_amount, currency, expected_delivery_date, notes } = req.body;
  try {
    const updatedOrder = await pool.query(
      `UPDATE purchase_orders SET supplier_id = $1, order_number = $2, status = $3, total_amount = $4, currency = $5, expected_delivery_date = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [supplier_id, order_number, status || 'Pending', total_amount || 0, currency || 'TZS', expected_delivery_date, notes, orderId, tenant_id]
    );
    if (updatedOrder.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found or tenant mismatch' });
    await recordAudit({ tenantId: tenant_id, userId: req.user?.id || null, action: 'update_purchase_order', entity: 'purchase_order', details: { purchase_order_id: updatedOrder.rows[0].id, status, total_amount } });
    res.json({ message: 'Purchase order updated successfully', purchase_order: updatedOrder.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/purchase-orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedOrder = await pool.query('DELETE FROM purchase_orders WHERE id = $1 AND tenant_id = $2 RETURNING *', [orderId, tenant_id]);
    if (deletedOrder.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found or tenant mismatch' });
    await recordAudit({ tenantId: tenant_id, userId: req.user?.id || null, action: 'delete_purchase_order', entity: 'purchase_order', details: { purchase_order_id: deletedOrder.rows[0].id, order_number: deletedOrder.rows[0].order_number } });
    res.json({ message: 'Purchase order deleted successfully', purchase_order: deletedOrder.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const records = await pool.query(
      `SELECT a.*, u.name AS employee_name
       FROM attendance_records a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.tenant_id = $1 ORDER BY a.work_date DESC`,
      [tenantId]
    );
    res.json(records.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  const { tenant_id, user_id, work_date, status, check_in, check_out, notes } = req.body;
  try {
    const record = await pool.query(
      `INSERT INTO attendance_records (tenant_id, user_id, work_date, status, check_in, check_out, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenant_id, user_id, work_date, status || 'Present', check_in, check_out, notes]
    );
    res.json({ message: 'Attendance recorded successfully', attendance: record.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/:recordId', async (req, res) => {
  const { recordId } = req.params;
  const { tenant_id, user_id, work_date, status, check_in, check_out, notes } = req.body;
  try {
    const updatedRecord = await pool.query(
      `UPDATE attendance_records SET user_id = $1, work_date = $2, status = $3, check_in = $4, check_out = $5, notes = $6
       WHERE id = $7 AND tenant_id = $8 RETURNING *`,
      [user_id, work_date, status || 'Present', check_in, check_out, notes, recordId, tenant_id]
    );
    if (updatedRecord.rows.length === 0) return res.status(404).json({ error: 'Attendance record not found or tenant mismatch' });
    res.json({ message: 'Attendance updated successfully', attendance: updatedRecord.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/:recordId', async (req, res) => {
  const { recordId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedRecord = await pool.query('DELETE FROM attendance_records WHERE id = $1 AND tenant_id = $2 RETURNING *', [recordId, tenant_id]);
    if (deletedRecord.rows.length === 0) return res.status(404).json({ error: 'Attendance record not found or tenant mismatch' });
    res.json({ message: 'Attendance record deleted successfully', attendance: deletedRecord.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer-debts/:tenantId/:debtId', async (req, res) => {
  const { tenantId, debtId } = req.params;
  try {
    const debt = await pool.query(
      'SELECT * FROM customer_debts WHERE tenant_id = $1 AND id = $2',
      [tenantId, debtId]
    );
    if (debt.rows.length === 0) return res.status(404).json({ error: 'Debt not found' });
    res.json(debt.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customer-debts/:debtId', async (req, res) => {
  const { debtId } = req.params;
  const { tenant_id, sale_reference, amount, due_date, status } = req.body;
  try {
    const updatedDebt = await pool.query(
      `UPDATE customer_debts SET sale_reference = $1, amount = $2, due_date = $3, status = $4
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [sale_reference, amount, due_date, status || 'Pending', debtId, tenant_id]
    );
    if (updatedDebt.rows.length === 0) return res.status(404).json({ error: 'Debt not found or tenant mismatch' });
    res.json({ message: 'Debt updated successfully', debt: updatedDebt.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customer-debts/:debtId', async (req, res) => {
  const { debtId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedDebt = await pool.query(
      'DELETE FROM customer_debts WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [debtId, tenant_id]
    );
    if (deletedDebt.rows.length === 0) return res.status(404).json({ error: 'Debt not found or tenant mismatch' });
    res.json({ message: 'Debt deleted successfully', debt: deletedDebt.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer-payments/:tenantId/:paymentId', async (req, res) => {
  const { tenantId, paymentId } = req.params;
  try {
    const payment = await pool.query(
      'SELECT * FROM customer_payments WHERE tenant_id = $1 AND id = $2',
      [tenantId, paymentId]
    );
    if (payment.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customer-payments/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  const { tenant_id, customer_id, debt_id, amount, payment_method, notes } = req.body;
  try {
    const updatedPayment = await pool.query(
      `UPDATE customer_payments SET customer_id = $1, debt_id = $2, amount = $3, payment_method = $4, notes = $5
       WHERE id = $6 AND tenant_id = $7 RETURNING *`,
      [customer_id || null, debt_id || null, amount, payment_method || 'Cash', notes, paymentId, tenant_id]
    );
    if (updatedPayment.rows.length === 0) return res.status(404).json({ error: 'Payment not found or tenant mismatch' });
    res.json({ message: 'Payment updated successfully', payment: updatedPayment.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customer-payments/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedPayment = await pool.query(
      'DELETE FROM customer_payments WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [paymentId, tenant_id]
    );
    if (deletedPayment.rows.length === 0) return res.status(404).json({ error: 'Payment not found or tenant mismatch' });
    res.json({ message: 'Payment deleted successfully', payment: deletedPayment.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. FINANCIAL & EXPENSE MANAGEMENT API
app.get('/api/expenses/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const expenses = await pool.query('SELECT * FROM expenses WHERE tenant_id = $1 ORDER BY expense_date DESC', [tenantId]);
    res.json(expenses.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  const { tenant_id, category, vendor, amount, currency, payment_method, expense_date, description } = req.body;
  try {
    const expense = await pool.query(
      `INSERT INTO expenses (tenant_id, category, vendor, amount, currency, payment_method, expense_date, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenant_id, category, vendor, amount, currency || 'TZS', payment_method || 'Cash', expense_date || new Date(), description]
    );
    res.json({ message: 'Expense recorded successfully', expense: expense.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:expenseId', async (req, res) => {
  const { expenseId } = req.params;
  const { tenant_id, category, vendor, amount, currency, payment_method, expense_date, description } = req.body;
  try {
    const updatedExpense = await pool.query(
      `UPDATE expenses SET category = $1, vendor = $2, amount = $3, currency = $4, payment_method = $5, expense_date = $6, description = $7
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [category, vendor, amount, currency, payment_method, expense_date, description, expenseId, tenant_id]
    );
    if (updatedExpense.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or tenant mismatch' });
    }
    res.json({ message: 'Expense updated successfully', expense: updatedExpense.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:expenseId', async (req, res) => {
  const { expenseId } = req.params;
  const { tenant_id } = req.body;
  try {
    const deletedExpense = await pool.query('DELETE FROM expenses WHERE id = $1 AND tenant_id = $2 RETURNING *', [expenseId, tenant_id]);
    if (deletedExpense.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found or tenant mismatch' });
    }
    res.json({ message: 'Expense deleted successfully', expense: deletedExpense.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finance/summary/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const revenueData = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM sales WHERE tenant_id = $1`,
      [tenantId]
    );
    const expenseData = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE tenant_id = $1`,
      [tenantId]
    );
    const outstandingData = await pool.query(
      `SELECT COALESCE(SUM(outstanding_balance), 0) AS total_outstanding FROM customers WHERE tenant_id = $1`,
      [tenantId]
    );

    const totalRevenue = parseFloat(revenueData.rows[0].total_revenue || 0);
    const totalExpenses = parseFloat(expenseData.rows[0].total_expenses || 0);
    const profitLoss = totalRevenue - totalExpenses;

    res.json({
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      profit_loss: profitLoss,
      total_outstanding: parseFloat(outstandingData.rows[0].total_outstanding || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/aging/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const agingRows = await pool.query(
      `SELECT c.id AS customer_id,
              c.name AS customer_name,
              c.outstanding_balance,
              GREATEST(0, DATE_PART('day', NOW()::date - COALESCE(MAX(d.due_date), NOW()::date))) AS overdue_days,
              CASE
                WHEN MAX(d.due_date) IS NULL THEN 'Current'
                WHEN DATE_PART('day', NOW()::date - MAX(d.due_date)) <= 30 THEN '0-30'
                WHEN DATE_PART('day', NOW()::date - MAX(d.due_date)) <= 60 THEN '31-60'
                WHEN DATE_PART('day', NOW()::date - MAX(d.due_date)) <= 90 THEN '61-90'
                ELSE '90+'
              END AS aging_category,
              COUNT(d.id) AS total_debts
       FROM customers c
       LEFT JOIN customer_debts d ON d.customer_id = c.id
       WHERE c.tenant_id = $1
         AND c.outstanding_balance > 0
       GROUP BY c.id, c.name, c.outstanding_balance
       ORDER BY aging_category, c.name;`,
      [tenantId]
    );

    const agingTotals = await pool.query(
      `SELECT CASE
                WHEN MAX(d.due_date) IS NULL THEN 'Current'
                WHEN DATE_PART('day', NOW()::date - MAX(d.due_date)) <= 30 THEN '0-30'
                WHEN DATE_PART('day', NOW()::date - MAX(d.due_date)) <= 60 THEN '31-60'
                WHEN DATE_PART('day', NOW()::date - MAX(d.due_date)) <= 90 THEN '61-90'
                ELSE '90+'
              END AS aging_category,
              COALESCE(SUM(c.outstanding_balance), 0) AS bucket_total
       FROM customers c
       LEFT JOIN customer_debts d ON d.customer_id = c.id
       WHERE c.tenant_id = $1
         AND c.outstanding_balance > 0
       GROUP BY aging_category
       ORDER BY aging_category;`,
      [tenantId]
    );

    res.json({
      aging: agingRows.rows,
      totals: agingTotals.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize Server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 JengaPlus Server running on Port ${PORT}`);
  console.log('✅ Environment variables validated');
  // Database reset is now a manual operation only for safety
  // Use: POST /api/admin/reset-database (with proper authorization)
  console.log('📌 Database reset disabled on startup (manual operation only)');
});
