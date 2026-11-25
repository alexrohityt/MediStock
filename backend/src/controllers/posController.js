import crypto from "node:crypto";
import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import Sale from "../models/Sale.js";
import { getPharmacyForUser } from "../services/pharmacyAccess.js";
import { changeBatchStock, rollbackStockOperation } from "../services/stockOperationService.js";

export async function listSales(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.json({ success: true, data: [] });
    const filter = { pharmacyId: pharmacy._id, status: "COMPLETED" };
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }
    const sales = await Sale.find(filter)
      .populate("cashierId", "name")
      .populate("lines.medicineId", "medicineName brandName strength")
      .sort({ createdAt: -1 })
      .limit(Math.min(100, Math.max(1, Number(req.query.limit) || 50)));
    res.json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
}

export async function createSale(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const idempotencyKey = String(req.body.idempotencyKey || "").trim();
    if (!idempotencyKey || idempotencyKey.length > 120) {
      return res.status(422).json({ success: false, message: "A sale idempotency key is required" });
    }
    if (!Array.isArray(req.body.items) || req.body.items.length === 0 || req.body.items.length > 100) {
      return res.status(422).json({ success: false, message: "Provide between 1 and 100 sale items" });
    }
    if (!["CASH", "CARD", "UPI", "OTHER"].includes(req.body.paymentMethod)) {
      return res.status(422).json({ success: false, message: "Choose a supported tender type" });
    }
    if (new Set(req.body.items.map((item) => String(item.inventoryId))).size !== req.body.items.length) {
      return res.status(422).json({ success: false, message: "Each batch can appear only once in a sale" });
    }

    let sale = await Sale.findOne({ pharmacyId: pharmacy._id, idempotencyKey });
    if (sale?.status === "COMPLETED") return res.json({ success: true, data: await populateSale(sale._id) });
    if (sale?.status === "FAILED") return res.status(409).json({ success: false, message: "This sale attempt failed; start a new sale" });

    if (!sale) {
      const lines = [];
      let subtotal = 0;
      for (const item of req.body.items) {
        const quantity = Number(item.quantity);
        if (!mongoose.isValidObjectId(item.inventoryId) || !Number.isInteger(quantity) || quantity < 1) {
          return res.status(422).json({ success: false, message: "Each sale item needs an inventory ID and a positive whole quantity" });
        }
        const stock = await Inventory.findOne({
          _id: item.inventoryId,
          pharmacyId: pharmacy._id,
          quantity: { $gte: quantity },
          expiryDate: { $gt: new Date() },
          availabilityStatus: { $nin: ["DISCONTINUED", "EXPIRED"] }
        }).populate("medicineId", "medicineName");
        if (!stock) return res.status(409).json({ success: false, message: "A selected batch is expired, unavailable or has insufficient stock" });
        const unitPrice = Number(stock.price);
        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        subtotal += lineTotal;
        lines.push({
          inventoryId: stock._id,
          medicineId: stock.medicineId._id,
          batchNumber: stock.batchNumber,
          quantity,
          unitPrice,
          lineTotal,
          applied: false
        });
      }
      try {
        sale = await Sale.create({
          pharmacyId: pharmacy._id,
          cashierId: req.user._id,
          invoiceNumber: `MS-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          idempotencyKey,
          status: "PROCESSING",
          customerName: req.body.customerName,
          customerPhone: req.body.customerPhone,
          lines,
          subtotal: Math.round(subtotal * 100) / 100,
          paymentMethod: req.body.paymentMethod,
          notes: req.body.notes
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
        sale = await Sale.findOne({ pharmacyId: pharmacy._id, idempotencyKey });
        if (!sale) throw error;
      }
    } else {
      const requestItems = req.body.items
        .map((item) => `${item.inventoryId}:${Number(item.quantity)}`)
        .sort();
      const savedItems = sale.lines
        .map((line) => `${line.inventoryId}:${line.quantity}`)
        .sort();
      if (
        sale.paymentMethod !== req.body.paymentMethod ||
        JSON.stringify(requestItems) !== JSON.stringify(savedItems) ||
        (sale.customerName || "") !== (req.body.customerName || "") ||
        (sale.customerPhone || "") !== (req.body.customerPhone || "")
      ) {
        return res.status(409).json({ success: false, message: "The idempotency key is already associated with a different sale" });
      }
    }

    try {
      for (const line of sale.lines) {
        if (line.applied) continue;
        await changeBatchStock({
          pharmacyId: pharmacy._id,
          inventoryId: line.inventoryId,
          quantityChange: -line.quantity,
          operationId: `sale:${sale.id}:${line.inventoryId}`
        });
        await Sale.updateOne(
          { _id: sale._id, status: "PROCESSING", "lines.inventoryId": line.inventoryId },
          { $set: { "lines.$.applied": true } }
        );
      }
      const currentSale = await Sale.findById(sale._id);
      if (!currentSale.lines.every((line) => line.applied)) {
        return res.status(503).json({ success: false, message: "Sale is still processing; retry with the same idempotency key" });
      }
      await Sale.updateOne({ _id: sale._id, status: "PROCESSING" }, { $set: { status: "COMPLETED" } });
    } catch (error) {
      const current = await Sale.findById(sale._id);
      if (current?.status === "COMPLETED") return res.json({ success: true, data: await populateSale(sale._id) });
      for (const line of sale.lines) await rollbackStockOperation(`sale:${sale.id}:${line.inventoryId}`);
      await Sale.updateOne({ _id: sale._id, status: "PROCESSING" }, { $set: { status: "FAILED" } });
      if (error.status) return res.status(error.status).json({ success: false, message: error.message });
      throw error;
    }

    const completed = await populateSale(sale._id);
    res.status(201).json({ success: true, data: completed });
  } catch (error) {
    next(error);
  }
}

async function populateSale(id) {
  return Sale.findById(id)
      .populate("cashierId", "name")
      .populate("lines.medicineId", "medicineName brandName strength");
}
