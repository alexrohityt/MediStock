import { Router } from "express";
import { authenticate, authorize, authorizePharmacyPermission, authorizeRequestRead } from "../middleware/auth.js";
import { uploadPrescription } from "../middleware/prescriptionUpload.js";
import { createRequest, myRequests, pharmacyRequests, getRequest, getRequestPrescription, updateRequestStatus, cancelRequest } from "../controllers/requestController.js";

const router = Router();
router.post("/", authenticate, authorize("CUSTOMER"), uploadPrescription, createRequest);
router.get("/my", authenticate, authorize("CUSTOMER"), myRequests);
router.get("/pharmacy", authenticate, authorizePharmacyPermission("requests"), pharmacyRequests);
router.get("/:id/prescription", authenticate, authorizeRequestRead, getRequestPrescription);
router.get("/:id", authenticate, authorizeRequestRead, getRequest);
router.patch("/:id/status", authenticate, authorizePharmacyPermission("requests"), updateRequestStatus);
router.patch("/:id/cancel", authenticate, authorize("CUSTOMER"), cancelRequest);

export default router;
