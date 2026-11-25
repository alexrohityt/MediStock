import { Router } from "express";
import { authenticate, authorizePharmacyPermission } from "../middleware/auth.js";
import { createInventory, myInventory, updateInventory, deleteInventory } from "../controllers/inventoryController.js";

const router = Router();
router.use(authenticate, authorizePharmacyPermission("inventory"));
router.post("/", createInventory);
router.get("/my", myInventory);
router.put("/:id", updateInventory);
router.delete("/:id", deleteInventory);

export default router;
