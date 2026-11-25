# MediStock

MediStock is a full-stack MERN medicine availability platform for customers, registered pharmacies and administrators. It provides verified pharmacy inventory search, price comparison, availability requests, notifications and role-based administration.

> Demo pharmacies and stock are fictional and must not be represented as real-world availability.

## Features

- Customer, pharmacy and administrator registration/login
- JWT authentication and server-side role authorization
- Medicine search by name, generic name, brand, strength and dosage form
- Approved-pharmacy and non-expired stock filtering
- Lowest-price, nearest-pharmacy and stock sorting
- Location-aware medicine search with stock quantity and per-unit price by pharmacy
- Customer home-delivery requests with address, order status and private prescription upload
- Pharmacy workspace with inventory CRUD, batch/expiry tracking and configurable low-stock thresholds
- Pharmacy location, contact and opening-hours management
- Low-stock, expired and near-expiry alerts
- Medicine availability requests and atomic fulfillment
- Request queues, status filters and notifications
- Pharmacy inventory and request reports with print support
- Supplier directory, purchase orders and idempotent partial batch receiving
- Counter-sale invoice history with atomic stock deductions; payment is recorded as a tender type only
- Pharmacy-scoped prescription handover status tracking without clinical review or dispensing decisions
- Pharmacy-managed staff accounts with server-checked module permissions
- Admin approval, pharmacy/user management and reports

The pharmacy dashboard follows common pharmacy-software patterns such as configurable workflows, medication synchronization and customer notifications described by [PioneerRx](https://www.pioneerrx.com/pharmacy-software). Prescription files attached to delivery orders are stored in MongoDB GridFS and can only be downloaded through an authenticated, customer/pharmacy-scoped API. Prescription tracking records handover status only; it does not provide clinical review, dispensing decisions, recommendations or automated substitutions. Delivery statuses are updated by pharmacy staff; no courier, delivery-fee calculation, payment processing, or delivery tracking integration is provided.

## Technology

- React 18, Vite, Tailwind CSS, React Router, Axios
- Node.js, Express 5
- MongoDB Atlas or local MongoDB, Mongoose
- JWT, bcryptjs, Helmet, CORS, express-validator and rate limiting

## Folder structure

```text
medistock/
  frontend/src/
    components/
    context/
    pages/
    services/
  backend/src/
    config/
    controllers/
    middleware/
    models/
    routes/
    validators/
  backend/scripts/
  docs/
```

## Setup

Requirements: Node.js 18 or later and MongoDB Atlas or local MongoDB. MongoDB Atlas is recommended. Local MongoDB standalone works for ordinary APIs; use a replica set for multi-document transaction guarantees.

```powershell
npm install
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
npm run dev
```

Set `MONGODB_URI` and JWT settings in `backend/.env`. The backend reports when the configured MongoDB server does not support transactions; stock-changing workflows use atomic, idempotent stock operations where applicable.

Existing MediStock databases created before batch tracking need the inventory index migration once:

```powershell
npm run migrate:inventory-batches -w backend
```

Demo seed:

```powershell
Copy-Item backend\.env.example backend\.env
# Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD
npm run seed -w backend
```

The seed creates no real pharmacy or stock listings. Sample development passwords are in `backend/scripts/seed.js`.

## Commands

```powershell
npm run dev
npm run build
npm run seed -w backend

npm start -w backend
```

The frontend runs at `http://localhost:5173`; the API runs at `http://localhost:5000`.

## Environment variables

### Backend

| Variable | Purpose |
|---|---|
| PORT | API port |
| MONGODB_URI | MongoDB connection URI |
| JWT_SECRET | Secret for signing JWT tokens |
| JWT_EXPIRES_IN | Token lifetime |
| CLIENT_ORIGIN | Allowed frontend origin |
| ADMIN_NAME | Seed administrator name |
| ADMIN_EMAIL | Seed administrator email |
| ADMIN_PASSWORD | Seed administrator password |

### Frontend

| Variable | Purpose |
|---|---|
| VITE_API_URL | API base URL, default `/api` |

## API overview

See [API documentation](docs/API.md) for routes and authorization.

## Testing

See [testing checklist](docs/TESTING.md).

Suggested verification:

1. Start MongoDB and configure `backend/.env`.
2. Run `npm run seed -w backend`.
3. Start the application.
4. Register a customer and pharmacy.
5. Log in as admin and approve the pharmacy.
6. Add inventory using authenticated pharmacy APIs.
7. Search as a customer and create a request.
8. Accept and fulfill the request as the pharmacy.
9. Create a supplier and purchase order, then receive a batch into inventory.
10. Record a counter sale and verify only that batch's stock decreases.
11. Create a staff account and verify unauthorized modules return 403.
12. Verify expired stock and another pharmacy's inventory are inaccessible.

## Deployment

- Deploy `frontend` to Vercel using `npm run build -w frontend`.
- Set `VITE_API_URL` to the deployed backend URL.
- Deploy `backend` to Render as a Node service with `npm start -w backend`.
- Configure MongoDB Atlas network access and environment secrets.
- Set `CLIENT_ORIGIN` to the exact deployed frontend origin.

## Security

JWTs are required on private APIs. Passwords are bcrypt-hashed. Public inventory search excludes pending/rejected pharmacies, expired stock and zero quantity. Fulfillment uses a MongoDB transaction and atomic quantity decrement. Demo and real credentials must remain outside source control.
