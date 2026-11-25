import { Router } from "express";
import { authenticate, authorizePharmacyPermission } from "../middleware/auth.js";
import { listSales, createSale } from "../controllers/posController.js";

const router = Router();
router.use(authenticate, authorizePharmacyPermission("sales"));
router.get("/sales", listSales);
router.post("/sales", createSale);

export default router;
