import crypto from "node:crypto";
import PrescriptionWorkflow from "../models/PrescriptionWorkflow.js";
import { getPharmacyForUser } from "../services/pharmacyAccess.js";

const nextStatuses = {
  RECEIVED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["READY_FOR_PICKUP", "REJECTED", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: []
};

export async function listPrescriptionWorkflows(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.json({ success: true, data: [] });
    const filter = { pharmacyId: pharmacy._id };
    if (req.query.status && nextStatuses[req.query.status]) filter.status = req.query.status;
    const records = await PrescriptionWorkflow.find(filter)
      .populate("statusHistory.changedBy", "name")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}

export async function createPrescriptionWorkflow(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const record = await PrescriptionWorkflow.create({
      pharmacyId: pharmacy._id,
      reference: `RX-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      status: "RECEIVED",
      statusHistory: [{ status: "RECEIVED", changedBy: req.user._id }]
    });
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}

export async function updatePrescriptionWorkflow(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const record = await PrescriptionWorkflow.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
    if (!record) return res.status(404).json({ success: false, message: "Prescription workflow record not found" });
    if (!nextStatuses[record.status]?.includes(req.body.status)) {
      return res.status(409).json({ success: false, message: "That status transition is not allowed" });
    }
    record.status = req.body.status;
    record.statusHistory.push({ status: req.body.status, changedBy: req.user._id });
    await record.save();
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
}
