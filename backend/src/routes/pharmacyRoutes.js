import { Router } from "express";
import { authenticate, authorize, authorizePharmacyPermission } from "../middleware/auth.js";
import { registerPharmacy, listPharmacies, myPharmacy, pharmacySummary, nearbyPharmacies, getPharmacy, updatePharmacy, verifyPharmacy } from "../controllers/pharmacyController.js";
import { listStaff, createStaff, updateStaff } from "../controllers/staffController.js";

const router = Router();
router.post("/register", authenticate, authorize("PHARMACY"), registerPharmacy);
router.get("/", listPharmacies);
router.get("/mine", authenticate, authorizePharmacyPermission("dashboard"), myPharmacy);
router.get("/mine/summary", authenticate, authorizePharmacyPermission("dashboard"), pharmacySummary);
router.get("/staff", authenticate, authorize("PHARMACY"), listStaff);
router.post("/staff", authenticate, authorize("PHARMACY"), createStaff);
router.patch("/staff/:id", authenticate, authorize("PHARMACY"), updateStaff);
router.get("/nearby", nearbyPharmacies);
router.get("/:id", getPharmacy);
router.put("/:id", authenticate, updatePharmacy);
router.patch("/:id/verify", authenticate, authorize("ADMIN"), verifyPharmacy);

export default router;
