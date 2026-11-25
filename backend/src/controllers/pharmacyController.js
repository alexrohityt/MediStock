import Pharmacy from "../models/Pharmacy.js";
import Inventory from "../models/Inventory.js";
import Request from "../models/Request.js";
import { getPharmacyForUser } from "../services/pharmacyAccess.js";

function validCoordinates(coordinates) {
  return Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every(Number.isFinite) &&
    coordinates[0] >= -180 &&
    coordinates[0] <= 180 &&
    coordinates[1] >= -90 &&
    coordinates[1] <= 90;
}

export async function registerPharmacy(req, res, next) {
  try {
    if (req.user.role !== "PHARMACY") return res.status(403).json({ success: false, message: "Only pharmacy accounts can register a pharmacy" });
    const existing = await Pharmacy.findOne({ $or: [{ ownerId: req.user.id }, { licenseNumber: req.body.licenseNumber }] });
    if (existing) return res.status(409).json({ success: false, message: "A pharmacy profile or license already exists" });
    if (!validCoordinates(req.body.coordinates)) {
      return res.status(422).json({ success: false, message: "Location must contain [longitude, latitude]" });
    }
    const pharmacy = await Pharmacy.create({
      ownerId: req.user.id,
      pharmacyName: req.body.pharmacyName,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      location: { type: "Point", coordinates: req.body.coordinates },
      phone: req.body.phone,
      licenseNumber: req.body.licenseNumber,
      openingTime: req.body.openingTime,
      closingTime: req.body.closingTime
    });
    res.status(201).json({ success: true, data: pharmacy });
  } catch (error) {
    next(error);
  }
}

export async function listPharmacies(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const filter = { verificationStatus: "APPROVED" };
    if (req.query.city) filter.city = new RegExp(req.query.city, "i");
    if (req.query.q) filter.$text = { $search: req.query.q };
    const [items, total] = await Promise.all([
      Pharmacy.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      Pharmacy.countDocuments(filter)
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function myPharmacy(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    res.json({ success: true, data: pharmacy });
  } catch (error) {
    next(error);
  }
}

export async function pharmacySummary(req, res, next) {
  try {
    const pharmacy = await getPharmacyForUser(req.user);
    if (!pharmacy) return res.json({ success: true, data: { pharmacy: null, inventory: { listings: 0, lowStock: 0, expiringSoon: 0, expired: 0, stockValue: 0 }, requests: { total: 0, pending: 0 } } });
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [stock, requests] = await Promise.all([
      Inventory.aggregate([
        { $match: { pharmacyId: pharmacy._id } },
        { $group: {
          _id: null,
          listings: { $sum: 1 },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", { $ifNull: ["$reorderLevel", 10] }] }] }, 1, 0] } },
          expiringSoon: { $sum: { $cond: [{ $and: [{ $gt: ["$expiryDate", now] }, { $lte: ["$expiryDate", in30Days] }] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $lte: ["$expiryDate", now] }, 1, 0] } },
          stockValue: { $sum: { $multiply: ["$quantity", "$price"] } }
        } }
      ]),
      Request.aggregate([
        { $match: { pharmacyId: pharmacy._id } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } }
        } }
      ])
    ]);
    res.json({
      success: true,
      data: {
        pharmacy,
        inventory: stock[0] ? { listings: stock[0].listings, lowStock: stock[0].lowStock, expiringSoon: stock[0].expiringSoon, expired: stock[0].expired, stockValue: Math.round(stock[0].stockValue * 100) / 100 } : { listings: 0, lowStock: 0, expiringSoon: 0, expired: 0, stockValue: 0 },
        requests: requests[0] || { total: 0, pending: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function nearbyPharmacies(req, res, next) {
  try {
    const longitude = Number(req.query.longitude);
    const latitude = Number(req.query.latitude);
    const maxDistance = Math.min(100000, Math.max(100, Number(req.query.radius) || 10000));
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return res.status(422).json({ success: false, message: "Longitude and latitude are required" });
    }
    const items = await Pharmacy.find({
      verificationStatus: "APPROVED",
      location: { $near: { $geometry: { type: "Point", coordinates: [longitude, latitude] }, $maxDistance: maxDistance } }
    }).limit(50);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getPharmacy(req, res, next) {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy not found" });
    if (pharmacy.verificationStatus !== "APPROVED" && req.user?.role !== "ADMIN" && String(pharmacy.ownerId) !== String(req.user?.id)) {
      return res.status(404).json({ success: false, message: "Pharmacy not found" });
    }
    res.json({ success: true, data: pharmacy });
  } catch (error) {
    next(error);
  }
}

export async function updatePharmacy(req, res, next) {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy not found" });
    if (req.user.role !== "ADMIN" && String(pharmacy.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "This pharmacy belongs to another account" });
    }
    const allowed = ["pharmacyName", "address", "city", "state", "pincode", "phone", "openingTime", "closingTime"];
    for (const field of allowed) if (req.body[field] !== undefined) pharmacy[field] = req.body[field];
    if (req.body.coordinates) {
      if (!validCoordinates(req.body.coordinates)) {
        return res.status(422).json({ success: false, message: "Invalid coordinates" });
      }
      pharmacy.location = { type: "Point", coordinates: req.body.coordinates };
    }
    await pharmacy.save();
    res.json({ success: true, data: pharmacy });
  } catch (error) {
    next(error);
  }
}

export async function verifyPharmacy(req, res, next) {
  try {
    const status = req.body.verificationStatus;
    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) return res.status(422).json({ success: false, message: "Invalid verification status" });
    const pharmacy = await Pharmacy.findByIdAndUpdate(req.params.id, { verificationStatus: status }, { new: true, runValidators: true });
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy not found" });
    res.json({ success: true, data: pharmacy });
  } catch (error) {
    next(error);
  }
}
