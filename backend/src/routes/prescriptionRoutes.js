import { Router } from "express";
import { authenticate, authorizePharmacyPermission } from "../middleware/auth.js";
import { listPrescriptionWorkflows, createPrescriptionWorkflow, updatePrescriptionWorkflow } from "../controllers/prescriptionController.js";

const router = Router();
router.use(authenticate, authorizePharmacyPermission("prescriptions"));
router.get("/", listPrescriptionWorkflows);
router.post("/", createPrescriptionWorkflow);
router.patch("/:id/status", updatePrescriptionWorkflow);

export default router;
