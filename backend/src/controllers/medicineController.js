import Medicine from "../models/Medicine.js";
import Inventory from "../models/Inventory.js";
import Pharmacy from "../models/Pharmacy.js";
import Request from "../models/Request.js";
import Sale from "../models/Sale.js";

export async function listMedicines(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const filter = {};
    if (req.query.q) filter.$text = { $search: req.query.q };
    if (req.query.dosageForm) filter.dosageForm = new RegExp(`^${req.query.dosageForm}$`, "i");

    const [items, total] = await Promise.all([
      Medicine.find(filter).sort(req.query.q ? { score: { $meta: "textScore" } } : { medicineName: 1 }).skip((page - 1) * limit).limit(limit),
      Medicine.countDocuments(filter)
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function getMedicine(req, res, next) {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found" });
    res.json({ success: true, data: medicine });
  } catch (error) {
    next(error);
  }
}

export async function searchMedicine(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(422).json({ success: false, message: "Search text is required" });
    const hasLatitude = req.query.latitude !== undefined;
    const hasLongitude = req.query.longitude !== undefined;
    if (hasLatitude !== hasLongitude) return res.status(422).json({ success: false, message: "Latitude and longitude must be provided together" });
    if (hasLatitude) {
      const latitude = Number(req.query.latitude);
      const longitude = Number(req.query.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return res.status(422).json({ success: false, message: "Location coordinates are invalid" });
      }
    }
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const medicineFilter = {
      $or: [
        { medicineName: new RegExp(escaped, "i") },
        { genericName: new RegExp(escaped, "i") },
        { brandName: new RegExp(escaped, "i") },
        ...(req.query.strength ? [{ strength: new RegExp(req.query.strength, "i") }] : [])
      ]
    };
    if (req.query.dosageForm) medicineFilter.dosageForm = new RegExp(`^${req.query.dosageForm}$`, "i");

    const medicines = await Medicine.find(medicineFilter).limit(30);
    if (!medicines.length) return res.json({ success: true, data: [] });

    const approvedIds = await Pharmacy.find({ verificationStatus: "APPROVED" }).distinct("_id");
    const now = new Date();
    const inventory = await Inventory.find({
      medicineId: { $in: medicines.map((medicine) => medicine._id) },
      pharmacyId: { $in: approvedIds },
      quantity: { $gt: 0 },
      expiryDate: { $gt: now },
      availabilityStatus: { $ne: "DISCONTINUED" }
    }).populate("medicineId").populate("pharmacyId");

    const longitude = req.query.longitude ? Number(req.query.longitude) : null;
    const latitude = req.query.latitude ? Number(req.query.latitude) : null;
    let results = inventory.filter((item) => item.pharmacyId).map((item) => {
      const pharmacy = item.pharmacyId;
      let distance = null;
      if (Number.isFinite(longitude) && Number.isFinite(latitude) && pharmacy.location?.coordinates) {
        const [lon, lat] = pharmacy.location.coordinates;
        distance = haversine(latitude, longitude, lat, lon);
      }
      return {
        inventoryId: item.id,
        medicine: item.medicineId,
        pharmacy: { id: pharmacy.id, name: pharmacy.pharmacyName, address: pharmacy.address, city: pharmacy.city, state: pharmacy.state, pincode: pharmacy.pincode, phone: pharmacy.phone, location: pharmacy.location, openingTime: pharmacy.openingTime, closingTime: pharmacy.closingTime },
        price: item.price,
        quantity: item.quantity,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        lastUpdated: item.lastUpdated,
        distance
      };
    });

    const sort = req.query.sort || "price";
    if (!["price", "nearest", "stock"].includes(sort)) return res.status(422).json({ success: false, message: "Invalid search sort option" });
    results.sort((a, b) => {
      if (sort === "nearest") {
        if (a.distance == null && b.distance != null) return 1;
        if (a.distance != null && b.distance == null) return -1;
        if (a.distance != null && b.distance != null && a.distance !== b.distance) return a.distance - b.distance;
      }
      return sort === "stock" ? b.quantity - a.quantity : a.price - b.price;
    });

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Number((radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

export async function createMedicine(req, res, next) {
  try {
    const medicine = await Medicine.create(req.body);
    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    next(error);
  }
}

export async function updateMedicine(req, res, next) {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found" });
    res.json({ success: true, data: medicine });
  } catch (error) {
    next(error);
  }
}

export async function deleteMedicine(req, res, next) {
  try {
    const [inventoryCount, requestCount, saleCount] = await Promise.all([
      Inventory.countDocuments({ medicineId: req.params.id }),
      Request.countDocuments({ medicineId: req.params.id }),
      Sale.countDocuments({ "lines.medicineId": req.params.id })
    ]);
    if (inventoryCount > 0 || requestCount > 0 || saleCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Medicine cannot be deleted while linked inventory, requests or sales exist"
      });
    }
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found" });
    res.json({ success: true, message: "Medicine deleted" });
  } catch (error) {
    next(error);
  }
}
