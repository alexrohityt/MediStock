import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { listMedicines, getMedicine, searchMedicine, createMedicine, updateMedicine, deleteMedicine } from "../controllers/medicineController.js";

const router = Router();
router.get("/", listMedicines);
router.get("/search", searchMedicine);
router.get("/:id", getMedicine);
router.post("/", authenticate, authorize("ADMIN"), createMedicine);
router.put("/:id", authenticate, authorize("ADMIN"), updateMedicine);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteMedicine);

export default router;
