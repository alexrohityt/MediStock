import Inventory from "../models/Inventory.js";
import { getPharmacyForUser } from "../services/pharmacyAccess.js";

async function ownedPharmacy(user) {
  return getPharmacyForUser(user);
}

export async function createInventory(req, res, next) {
  try {
    const pharmacy = await ownedPharmacy(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Complete your pharmacy profile first" });
    const { medicineId, quantity, reorderLevel, price, batchNumber, expiryDate } = req.body;
    if (quantity < 0 || reorderLevel < 0 || price < 0) return res.status(422).json({ success: false, message: "Quantity, reorder level and price cannot be negative" });
    const inventory = await Inventory.create({
      medicineId,
      pharmacyId: pharmacy.id,
      quantity,
      reorderLevel,
      price,
      batchNumber,
      expiryDate,
      availabilityStatus: quantity > 0 ? "AVAILABLE" : "OUT_OF_STOCK",
      lastUpdated: new Date()
    });
    res.status(201).json({ success: true, data: inventory });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "This medicine already exists in your inventory" });
    next(error);
  }
}

export async function myInventory(req, res, next) {
  try {
    const pharmacy = await ownedPharmacy(req.user);
    if (!pharmacy) return res.json({ success: true, data: [] });
    const items = await Inventory.find({ pharmacyId: pharmacy.id }).populate("medicineId").sort({ lastUpdated: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function updateInventory(req, res, next) {
  try {
    const pharmacy = await ownedPharmacy(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    if (["quantity", "reorderLevel", "price"].some((field) => req.body[field] !== undefined && (!Number.isFinite(Number(req.body[field])) || Number(req.body[field]) < 0))) {
      return res.status(422).json({ success: false, message: "Quantity, reorder level and price must be non-negative numbers" });
    }
    const item = await Inventory.findOne({ _id: req.params.id, pharmacyId: pharmacy.id });
    if (!item) return res.status(404).json({ success: false, message: "Inventory item not found or access denied" });
    for (const field of ["quantity", "reorderLevel", "price", "batchNumber", "expiryDate"]) if (req.body[field] !== undefined) item[field] = req.body[field];
    item.availabilityStatus = item.quantity > 0 ? "AVAILABLE" : "OUT_OF_STOCK";
    item.lastUpdated = new Date();
    await item.save();
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function deleteInventory(req, res, next) {
  try {
    const pharmacy = await ownedPharmacy(req.user);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const item = await Inventory.findOneAndDelete({ _id: req.params.id, pharmacyId: pharmacy.id });
    if (!item) return res.status(404).json({ success: false, message: "Inventory item not found or access denied" });
    res.json({ success: true, message: "Inventory item deleted" });
  } catch (error) {
    next(error);
  }
}
