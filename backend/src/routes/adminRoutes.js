import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { dashboard, users, createAdmin, setUserStatus, adminPharmacies, adminMedicines, reports } from "../controllers/adminController.js";
import { createAdminValidation } from "../validators/authValidators.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(authenticate, authorize("ADMIN"));
router.get("/dashboard", dashboard);
router.get("/users", users);
router.post("/users/admin", createAdminValidation, validate, createAdmin);
router.patch("/users/:id/status", setUserStatus);
router.get("/pharmacies", adminPharmacies);
router.get("/medicines", adminMedicines);
router.get("/reports", reports);

export default router;
