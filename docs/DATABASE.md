# MediStock Database Documentation

## Collections

- `users`: account identity, role and active state
- `pharmacies`: pharmacy profile, verification and GeoJSON location
- `medicines`: central catalogue records
- `inventories`: pharmacy medicine stock, price and batch information
- `requests`: customer availability requests
- `notifications`: user-specific status messages

## Important indexes

- Unique `users.email`
- Unique `pharmacies.licenseNumber`
- Compound unique `inventories.{pharmacyId, medicineId}`
- 2dsphere `pharmacies.location`
- Text indexes for medicine names and pharmacy names

## Search behavior

Inventory search uses medicine references, approved pharmacy references, positive quantity and expiry strictly greater than the current server time.

## Ownership

Inventory and pharmacy updates verify ownership using the authenticated MongoDB user ID. Customer request reads verify customer ownership. Admin access is checked in middleware.
