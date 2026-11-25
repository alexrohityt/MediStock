import crypto from "node:crypto";
import Supplier from "../models/Supplier.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Medicine from "../models/Medicine.js";
import { getPharmacyForUser } from "../services/pharmacyAccess.js";
import { changeBatchStock } from "../services/stockOperationService.js";

export async function listSuppliers(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.json({ success: true, data: [] });
    const suppliers = await Supplier.find({ pharmacyId: pharmacy._id }).sort({ name: 1 });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Create a pharmacy profile first" });
    const supplier = await Supplier.create({
      pharmacyId: pharmacy._id,
      name: req.body.name,
      contactName: req.body.contactName,
      phone: req.body.phone,
      email: req.body.email,
      address: req.body.address,
      notes: req.body.notes
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
}

export async function updateSupplier(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    for (const field of ["name", "contactName", "phone", "email", "address", "notes", "isActive"]) {
      if (req.body[field] !== undefined) supplier[field] = req.body[field];
    }
    await supplier.save();
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
}

export async function listPurchaseOrders(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.json({ success: true, data: [] });
    const orders = await PurchaseOrder.find({ pharmacyId: pharmacy._id })
      .populate("supplierId", "name phone")
      .populate("lines.medicineId", "medicineName brandName strength")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

export async function createPurchaseOrder(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Create a pharmacy profile first" });
    const supplier = await Supplier.findOne({ _id: req.body.supplierId, pharmacyId: pharmacy._id, isActive: true });
    if (!supplier) return res.status(404).json({ success: false, message: "Active supplier not found" });
    if (!Array.isArray(req.body.lines) || req.body.lines.length === 0 || req.body.lines.length > 100) {
      return res.status(422).json({ success: false, message: "Provide between 1 and 100 order lines" });
    }
    const lines = req.body.lines.map((line) => ({
      medicineId: line.medicineId,
      orderedQuantity: Number(line.orderedQuantity),
      unitCost: Number(line.unitCost),
      receivedQuantity: 0
    }));
    if (lines.some((line) => !Number.isInteger(line.orderedQuantity) || line.orderedQuantity < 1 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) {
      return res.status(422).json({ success: false, message: "Each order line needs a positive whole quantity and non-negative unit cost" });
    }
    const uniqueIds = [...new Set(lines.map((line) => String(line.medicineId)))];
    if (uniqueIds.length !== lines.length) return res.status(422).json({ success: false, message: "Use one order line per medicine; receive partial deliveries against that line" });
    const found = await Medicine.countDocuments({ _id: { $in: uniqueIds } });
    if (found !== uniqueIds.length) return res.status(422).json({ success: false, message: "One or more medicines are not in the catalogue" });

    const order = await PurchaseOrder.create({
      pharmacyId: pharmacy._id,
      supplierId: supplier._id,
      createdBy: req.user._id,
      orderNumber: `MPO-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      lines,
      expectedDeliveryAt: req.body.expectedDeliveryAt || undefined,
      notes: req.body.notes
    });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function updatePurchaseOrderStatus(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const order = await PurchaseOrder.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (req.body.status === "ORDERED" && order.status === "DRAFT") {
      order.status = "ORDERED";
    } else if (req.body.status === "CANCELLED" && ["DRAFT", "ORDERED"].includes(order.status)) {
      if (order.lines.some((line) => (line.pendingQuantity || 0) > 0)) {
        return res.status(409).json({ success: false, message: "Resume or complete pending receipts before cancelling this order" });
      }
      order.status = "CANCELLED";
    } else {
      return res.status(409).json({ success: false, message: "This purchase order cannot move to that status" });
    }
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function receivePurchaseOrder(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const order = await PurchaseOrder.findOne({ _id: req.params.id, pharmacyId: pharmacy._id });
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    const receiptId = String(req.body.receiptId || "").trim();
    if (!receiptId || receiptId.length > 100) return res.status(422).json({ success: false, message: "A receipt ID is required for safe retries" });

    let receipt = order.receipts.find((item) => item.receiptId === receiptId);
    if (!receipt) {
      if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status)) {
        return res.status(409).json({ success: false, message: "Only ordered purchase orders can be received" });
      }
      if (!Array.isArray(req.body.items) || req.body.items.length !== 1) {
        return res.status(422).json({ success: false, message: "Receive one batch per receipt operation" });
      }
      const received = req.body.items[0];
      const line = order.lines.find((item) => String(item.medicineId) === String(received.medicineId));
      const quantity = Number(received.quantity);
      const expiryDate = new Date(received.expiryDate);
      const sellingPrice = Number(received.sellingPrice);
      if (!line || !Number.isInteger(quantity) || quantity < 1 || quantity > line.orderedQuantity - line.receivedQuantity - (line.pendingQuantity || 0)) {
        return res.status(422).json({ success: false, message: "Received quantity must fit within the outstanding order quantity" });
      }
      if (!received.batchNumber?.trim() || !Number.isFinite(expiryDate.getTime()) || expiryDate <= new Date() || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
        return res.status(422).json({ success: false, message: "Valid batch number, future expiry and non-negative selling price are required" });
      }
      receipt = order.receipts.create({
        receiptId,
        medicineId: line.medicineId,
        batchNumber: received.batchNumber.trim(),
        quantity,
        expiryDate,
        sellingPrice,
        reorderLevel: Math.max(0, Number(received.reorderLevel) || 10),
        status: "PROCESSING"
      });
      line.pendingQuantity = (line.pendingQuantity || 0) + quantity;
      order.receipts.push(receipt);
      await order.save();
    }

    if (receipt.status === "RECEIVED") {
      await updateDerivedOrderStatus(order._id, pharmacy._id);
      const completed = await PurchaseOrder.findById(order._id)
        .populate("supplierId", "name phone")
        .populate("lines.medicineId", "medicineName brandName strength");
      return res.json({ success: true, data: completed });
    }

    await changeBatchStock({
      pharmacyId: pharmacy._id,
      medicineId: receipt.medicineId,
      batchNumber: receipt.batchNumber,
      quantityChange: receipt.quantity,
      operationId: `purchase:${order.id}:${receipt.receiptId}`,
      price: receipt.sellingPrice,
      reorderLevel: receipt.reorderLevel,
      expiryDate: receipt.expiryDate
    });

    await PurchaseOrder.updateOne(
      { _id: order._id, pharmacyId: pharmacy._id, receipts: { $elemMatch: { receiptId, status: "PROCESSING" } } },
      {
        $inc: {
          "lines.$[line].receivedQuantity": receipt.quantity,
          "lines.$[line].pendingQuantity": -receipt.quantity
        },
        $set: { "receipts.$[receipt].status": "RECEIVED" }
      },
      {
        arrayFilters: [
          { "line.medicineId": receipt.medicineId },
          { "receipt.receiptId": receiptId, "receipt.status": "PROCESSING" }
        ]
      }
    );
    await updateDerivedOrderStatus(order._id, pharmacy._id);
    const completed = await PurchaseOrder.findById(order._id)
      .populate("supplierId", "name phone")
      .populate("lines.medicineId", "medicineName brandName strength");
    res.json({ success: true, data: completed });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
}

async function updateDerivedOrderStatus(orderId, pharmacyId) {
  const order = await PurchaseOrder.findOne({ _id: orderId, pharmacyId });
  if (!order) return;
  const fullyReceived = order.lines.every((line) => line.receivedQuantity === line.orderedQuantity);
  const partiallyReceived = order.lines.some((line) => line.receivedQuantity > 0);
  const status = fullyReceived ? "RECEIVED" : partiallyReceived ? "PARTIALLY_RECEIVED" : "ORDERED";
  await PurchaseOrder.updateOne({ _id: orderId, pharmacyId }, { $set: { status } });
}
