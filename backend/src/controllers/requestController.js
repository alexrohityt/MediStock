import mongoose from "mongoose";
import Request from "../models/Request.js";
import Pharmacy from "../models/Pharmacy.js";
import Medicine from "../models/Medicine.js";
import Inventory from "../models/Inventory.js";
import Notification from "../models/Notification.js";
import { consumeInventoryStock } from "../services/inventoryService.js";
import { consumeInventoryStock as consumeStockStandalone, rollbackStockOperation } from "../services/stockOperationService.js";
import { getPharmacyForUser } from "../services/pharmacyAccess.js";
import { supportsTransactions } from "../services/mongoTransactions.js";
import { readPrescription, removePrescription, savePrescription } from "../services/prescriptionStorage.js";

const deliveryStatuses = ["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];

function isAllowedStatusChange(request, status) {
  if (request.status === status) return true;
  if (request.status === "PENDING") return ["ACCEPTED", "REJECTED"].includes(status);
  if (request.fulfillmentType === "DELIVERY") {
    return (request.status === "ACCEPTED" && status === "PREPARING") ||
      (request.status === "PREPARING" && status === "OUT_FOR_DELIVERY") ||
      (request.status === "OUT_FOR_DELIVERY" && status === "DELIVERED");
  }
  return request.status === "ACCEPTED" && status === "FULFILLED";
}

function consumesStock(request, status) {
  return request.fulfillmentType === "DELIVERY" ? status === "DELIVERED" : status === "FULFILLED";
}

function statusLabel(status) {
  return status.toLowerCase().replaceAll("_", " ");
}

export async function createRequest(req, res, next) {
  let uploadedPrescription;
  try {
    const pharmacy = await Pharmacy.findOne({ _id: req.body.pharmacyId, verificationStatus: "APPROVED" });
    if (!pharmacy) return res.status(404).json({ success: false, message: "Approved pharmacy not found" });
    const quantity = Number(req.body.requestedQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return res.status(422).json({ success: false, message: "Quantity must be a whole number between 1 and 1000" });
    }
    const medicine = await Medicine.findById(req.body.medicineId);
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found" });
    const fulfillmentType = req.body.fulfillmentType || "PICKUP";
    if (!["PICKUP", "DELIVERY"].includes(fulfillmentType)) {
      return res.status(422).json({ success: false, message: "Choose pickup or delivery" });
    }

    let deliveryAddress;
    let unitPrice;
    if (fulfillmentType === "DELIVERY") {
      try {
        deliveryAddress = typeof req.body.deliveryAddress === "string" ? JSON.parse(req.body.deliveryAddress) : req.body.deliveryAddress;
      } catch {
        return res.status(422).json({ success: false, message: "Enter a valid delivery address" });
      }
      const requiredAddress = ["line1", "city", "state", "pincode"];
      if (!deliveryAddress || requiredAddress.some((field) => typeof deliveryAddress[field] !== "string" || !deliveryAddress[field].trim())) {
        return res.status(422).json({ success: false, message: "Street address, city, state, and postal code are required for delivery" });
      }
      if (!req.body.inventoryId) return res.status(422).json({ success: false, message: "Select an available stock listing" });
      const stock = await Inventory.findOne({
        _id: req.body.inventoryId,
        pharmacyId: pharmacy._id,
        medicineId: medicine._id,
        quantity: { $gte: quantity },
        expiryDate: { $gt: new Date() },
        availabilityStatus: { $nin: ["DISCONTINUED", "EXPIRED"] }
      });
      if (!stock) return res.status(409).json({ success: false, message: "This batch no longer has enough available stock; refresh search and try again" });
      unitPrice = stock.price;
    }
    if (medicine.prescriptionRequired && !req.file) {
      return res.status(422).json({ success: false, message: "A prescription is required for this medicine" });
    }
    if (req.file) uploadedPrescription = await savePrescription(req.file);

    let request;
    try {
      request = await Request.create({
        customerId: req.user.id,
        pharmacyId: pharmacy.id,
        medicineId: medicine.id,
        inventoryId: fulfillmentType === "DELIVERY" ? req.body.inventoryId : undefined,
        requestedQuantity: quantity,
        fulfillmentType,
        deliveryAddress: fulfillmentType === "DELIVERY" ? {
          line1: deliveryAddress.line1,
          line2: deliveryAddress.line2 || "",
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          pincode: deliveryAddress.pincode,
          instructions: deliveryAddress.instructions || ""
        } : undefined,
        unitPrice,
        prescription: uploadedPrescription,
        remarks: req.body.remarks || ""
      });
    } catch (error) {
      if (uploadedPrescription) await removePrescription(uploadedPrescription.fileId);
      throw error;
    }
    let notificationWarning;
    try {
      await Notification.create({ userId: pharmacy.ownerId, title: "New medicine request", message: `A new availability request has been received for quantity ${request.requestedQuantity}.` });
    } catch (notificationError) {
      console.error("Request was created but the pharmacy notification failed:", notificationError);
      notificationWarning = "Your order was placed, but the pharmacy notification failed. Contact the pharmacy if needed.";
    }
    res.status(201).json({ success: true, data: request, ...(notificationWarning ? { warning: notificationWarning } : {}) });
  } catch (error) {
    if (uploadedPrescription) {
      const persistedRequest = await Request.exists({ "prescription.fileId": uploadedPrescription.fileId });
      if (!persistedRequest) await removePrescription(uploadedPrescription.fileId);
    }
    next(error);
  }
}

export async function myRequests(req, res, next) {
  try {
    const items = await Request.find({ customerId: req.user.id }).populate("pharmacyId medicineId").sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function pharmacyRequests(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.json({ success: true, data: [] });
    const items = await Request.find({ pharmacyId: pharmacy.id }).populate("customerId", "name email phone").populate("medicineId").sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getRequest(req, res, next) {
  try {
    const request = await Request.findById(req.params.id).populate("customerId pharmacyId medicineId");
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    const pharmacy = await Pharmacy.findById(request.pharmacyId);
    const allowed = req.user.role === "ADMIN" ||
      String(request.customerId._id) === String(req.user.id) ||
      (pharmacy && (String(pharmacy.ownerId) === String(req.user.id) || String(pharmacy._id) === String(req.user.pharmacyId)));
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

export async function getRequestPrescription(req, res, next) {
  try {
    const request = await Request.findById(req.params.id).select("+prescription.fileId");
    if (!request?.prescription?.fileId) return res.status(404).json({ success: false, message: "Prescription not found" });
    let allowed = String(request.customerId) === String(req.user.id);
    if (req.user.role === "PHARMACY" || req.user.role === "STAFF") {
      const pharmacy = await getPharmacyForUser(req.user);
      allowed = Boolean(pharmacy && String(request.pharmacyId) === String(pharmacy._id));
    }
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const contents = await readPrescription(request.prescription.fileId);
    const extension = request.prescription.mimeType === "application/pdf" ? "pdf"
      : request.prescription.mimeType === "image/png" ? "png" : "jpg";
    res.set({
      "Content-Type": request.prescription.mimeType,
      "Content-Disposition": `attachment; filename="prescription.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }).send(contents);
  } catch (error) {
    next(error);
  }
}

export async function updateRequestStatus(req, res, next) {
  if (!(await supportsTransactions())) {
    let activeOperationId;
    let activeDedupeKey;
    let activeRequestId;
    let activeTargetStatus;
    try {
      const pharmacy = await getPharmacyForUser(req.user);
      if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
      const request = await Request.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
      if (!request) return res.status(404).json({ success: false, message: "Request not found" });
      const status = req.body.status;
      if (request.status === status) return res.json({ success: true, data: request });
      if (!deliveryStatuses.includes(status) && !["REJECTED", "FULFILLED"].includes(status)) return res.status(422).json({ success: false, message: "Invalid request status" });
      if (!isAllowedStatusChange(request, status)) return res.status(422).json({ success: false, message: "This request cannot move to that status" });

      activeRequestId = request.id;
      activeTargetStatus = status;
      activeOperationId = consumesStock(request, status) ? `request:${request.id}:fulfill` : undefined;
      if (activeOperationId) {
        await consumeStockStandalone({
          pharmacyId: pharmacy._id,
          medicineId: request.medicineId,
          inventoryId: request.inventoryId,
          quantity: request.requestedQuantity,
          operationId: activeOperationId
        });
      }
      const dedupeKey = `request:${request.id}:${status}`;
      activeDedupeKey = dedupeKey;
      try {
        await Notification.updateOne(
          { dedupeKey },
          { $setOnInsert: { userId: request.customerId, title: "Request status updated", message: `Your medicine request is now ${statusLabel(status)}.`, dedupeKey } },
          { upsert: true }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
      const update = { status };
      if (req.body.remarks !== undefined) update.remarks = req.body.remarks;
      const updated = await Request.findOneAndUpdate(
        { _id: request._id, pharmacyId: pharmacy._id, status: request.status },
        { $set: update },
        { new: true, runValidators: true }
      );
      if (updated) return res.json({ success: true, data: updated });
      const current = await Request.findById(request._id);
      if (current?.status === status) return res.json({ success: true, data: current });
      if (activeOperationId) await rollbackStockOperation(activeOperationId);
      await Notification.deleteOne({ dedupeKey });
      activeOperationId = undefined;
      activeDedupeKey = undefined;
      return res.status(409).json({ success: false, message: "Request status changed before this update completed" });
    } catch (error) {
      const current = activeRequestId ? await Request.findById(activeRequestId) : null;
      if (activeOperationId && current?.status !== activeTargetStatus) await rollbackStockOperation(activeOperationId);
      if (activeDedupeKey && current?.status !== req.body.status) {
        await Notification.deleteOne({ dedupeKey: activeDedupeKey });
      }
      if (error.status) return res.status(error.status).json({ success: false, message: error.message });
      return next(error);
    }
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const pharmacy = await getPharmacyForUser(req.user, session);
      if (!pharmacy) throw Object.assign(new Error("Pharmacy profile not found"), { status: 404 });
      const request = await Request.findOne({ _id: req.params.id, pharmacyId: pharmacy.id }).session(session);
      if (!request) throw Object.assign(new Error("Request not found"), { status: 404 });
      const status = req.body.status;
      if (request.status === status) return;
      if (!deliveryStatuses.includes(status) && !["REJECTED", "FULFILLED"].includes(status)) throw Object.assign(new Error("Invalid request status"), { status: 422 });
      if (!isAllowedStatusChange(request, status)) throw Object.assign(new Error("This request cannot move to that status"), { status: 422 });
      if (consumesStock(request, status)) {
        await consumeInventoryStock({
          pharmacyId: pharmacy.id,
          medicineId: request.medicineId,
          inventoryId: request.inventoryId,
          quantity: request.requestedQuantity,
          session
        });
      }
      request.status = status;
      if (req.body.remarks !== undefined) request.remarks = req.body.remarks;
      await request.save({ session });
      await Notification.create([{ userId: request.customerId, title: "Request status updated", message: `Your medicine request is now ${statusLabel(status)}.` }], { session });
    });
    const request = await Request.findById(req.params.id);
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to update request" });
  } finally {
    await session.endSession();
  }
}

export async function cancelRequest(req, res, next) {
  try {
    const request = await Request.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user.id, status: { $in: ["PENDING", "ACCEPTED"] } },
      { $set: { status: "CANCELLED" } },
      { new: true, runValidators: true }
    );
    if (!request) {
      const existing = await Request.exists({ _id: req.params.id, customerId: req.user.id });
      return res.status(existing ? 409 : 404).json({
        success: false,
        message: existing ? "This request can no longer be cancelled" : "Request not found"
      });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}
