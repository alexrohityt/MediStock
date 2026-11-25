# MediStock SRS Outline

## 1. Introduction

MediStock provides medicine availability information and pharmacy inventory management. It is not a diagnostic or prescribing system.

## 2. Actors

- Customer
- Pharmacy
- Administrator

## 3. Functional requirements

- Account registration and authentication
- Role-specific dashboards
- Medicine catalogue and availability search
- Geolocation-assisted pharmacy search
- Inventory and batch management
- Availability requests and fulfillment
- Notifications
- Pharmacy verification and platform reporting

## 4. Non-functional requirements

- Secure password storage and JWT authorization
- Responsive UI
- MongoDB data validation and indexes
- Protected private APIs
- Safe error handling and loading states
- No auto-suggestion of medicine substitutes

## 5. Constraints

Availability depends on data maintained by registered pharmacies. Demo records are fictional.
