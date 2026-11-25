# MediStock API

All private endpoints require `Authorization: Bearer <token>`.

## Authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register customer or pharmacy |
| POST | `/api/auth/login` | Public | Return JWT and user |
| GET | `/api/auth/me` | Authenticated | Current user |

## Medicines

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/medicines` | Public | Paginated catalogue |
| GET | `/api/medicines/search` | Public | Availability search |
| GET | `/api/medicines/:id` | Public | Medicine details |
| POST/PUT/DELETE | `/api/medicines/:id` | Admin | Catalogue management |

Search parameters: `q`, `strength`, `dosageForm`, `sort`, `latitude`, `longitude`. `sort=nearest` sorts by calculated distance when both coordinates are supplied; results without a distance sort last. Each stock result includes its inventory ID, quantity and unit price.

## Pharmacies

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/pharmacies/register` | Pharmacy | Create profile |
| GET | `/api/pharmacies` | Public | Approved pharmacies |
| GET | `/api/pharmacies/mine` | Pharmacy | Current pharmacy profile |
| GET | `/api/pharmacies/mine/summary` | Pharmacy | Inventory alerts and request summary |
| GET | `/api/pharmacies/nearby` | Public | Geospatial nearby search |
| GET/PUT | `/api/pharmacies/:id` | Public/Owner/Admin | Details/update |
| PATCH | `/api/pharmacies/:id/verify` | Admin | Approve/reject |

## Inventory

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/inventory` | Pharmacy | Add inventory |
| GET | `/api/inventory/my` | Pharmacy | Owned inventory |
| PUT | `/api/inventory/:id` | Pharmacy | Update owned inventory |
| DELETE | `/api/inventory/:id` | Pharmacy | Delete owned inventory |

Inventory entries include `quantity`, `reorderLevel`, `price`, `batchNumber` and `expiryDate`. Quantities and prices cannot be negative.

## Requests and notifications

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/requests` | Customer | Create request |
| GET | `/api/requests/my` | Customer | Customer requests |
| GET | `/api/requests/pharmacy` | Pharmacy | Pharmacy requests |
| GET | `/api/requests/:id/prescription` | Request customer or assigned pharmacy | Download private prescription file |
| GET | `/api/requests/:id` | Owner/Pharmacy/Admin | Request details |
| PATCH | `/api/requests/:id/status` | Assigned pharmacy | Accept/reject; advance delivery through preparing, out for delivery and delivered |
| PATCH | `/api/requests/:id/cancel` | Customer | Cancel pending/accepted |
| GET | `/api/notifications` | Authenticated | User notifications |
| PATCH | `/api/notifications/:id/read` | Authenticated | Mark read |

## Admin

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Platform totals |
| GET | `/api/admin/users` | User list |
| PATCH | `/api/admin/users/:id/status` | Suspend/activate |
| GET | `/api/admin/pharmacies` | Pharmacy list |
| GET | `/api/admin/medicines` | Catalogue list |
| GET | `/api/admin/reports` | Aggregated reports |

## Pharmacy operations

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET/POST | `/api/procurement/suppliers` | Pharmacy / procurement staff | List or add suppliers |
| PUT | `/api/procurement/suppliers/:id` | Pharmacy / procurement staff | Update supplier or deactivate |
| GET/POST | `/api/procurement/orders` | Pharmacy / procurement staff | List or create purchase orders |
| PATCH | `/api/procurement/orders/:id/status` | Pharmacy / procurement staff | Mark ordered or cancel |
| POST | `/api/procurement/orders/:id/receive` | Pharmacy / procurement staff | Receive one batch; requires a stable `receiptId` for retries |
| GET/POST | `/api/pos/sales` | Pharmacy / sales staff | List invoices or record a sale |
| GET/POST | `/api/prescriptions` | Pharmacy / prescription staff | List or log metadata-only handovers |
| PATCH | `/api/prescriptions/:id/status` | Pharmacy / prescription staff | Advance workflow status |
| GET/POST | `/api/pharmacies/staff` | Pharmacy owner | List or create staff accounts |
| PATCH | `/api/pharmacies/staff/:id` | Pharmacy owner | Set module permissions or suspend |

Delivery requests use multipart form data with `fulfillmentType=DELIVERY`, medicine/pharmacy/inventory IDs, quantity, a JSON `deliveryAddress` and an optional `prescription` file (PDF/JPEG/PNG, up to 5 MB). A prescription is required when the selected medicine is marked as prescription-only. Prescription content is kept in MongoDB GridFS and is never publicly served; the download route checks the requesting customer or assigned pharmacy. Delivery status changes are manual; no courier integration is included. Counter sales accept an `idempotencyKey` and `items: [{ inventoryId, quantity }]`. Tender type is recorded only; no payment is processed or card data stored. The separate prescription handover workflow stores customer contact and status history only.
