import { Router } from "express";
import { authenticate, authorizePharmacyPermission } from "../middleware/auth.js";
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  listPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrder
} from "../controllers/procurementController.js";

const router = Router();
router.use(authenticate, authorizePharmacyPermission("procurement"));
router.get("/suppliers", listSuppliers);
router.post("/suppliers", createSupplier);
router.put("/suppliers/:id", updateSupplier);
router.get("/orders", listPurchaseOrders);
router.post("/orders", createPurchaseOrder);
router.patch("/orders/:id/status", updatePurchaseOrderStatus);
router.post("/orders/:id/receive", receivePurchaseOrder);

export default router;
