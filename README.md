# JengaPlus

A full-stack construction materials SaaS app with Expo React Native frontend and Node/Express backend.

## Run the backend

1. Open a terminal inside `backend`
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Copy `.env` from the sample or create one with your PostgreSQL connection string:
   ```bash
   DATABASE_URL="your_database_url_here"
   JWT_SECRET="your_secret_key"
   ```
4. Start the backend:
   ```bash
   npm start
   ```

## Run the frontend

1. Install Expo dependencies from the project root:
   ```bash
   npm install
   ```
2. Start Expo:
   ```bash
   npm run start
   ```

## Root convenience scripts

From the project root, you can also start the backend with:
```bash
npm run backend
```

## Notes

- The backend is configured for PostgreSQL.
- The frontend calls `http://10.36.51.199:5000/api` by default.
- Use `expo` on a device or emulator to load the app.

### New utilities

- To run a restock check and notify supplier/admin via SMS (POST):

```bash
curl -X POST 'http://localhost:5000/api/inventory/run-restock-check' \
   -H 'Authorization: Bearer <TOKEN>' \
   -H 'Content-Type: application/json' \
   -d '{"tenantId":1, "supplierPhone":"+2557xxxxxxxx"}'
```

- To fetch low-stock drafts (GET):

```bash
curl -H 'Authorization: Bearer <TOKEN>' http://localhost:5000/api/inventory/low/1
```
