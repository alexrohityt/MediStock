import User from "../models/User.js";
import Pharmacy from "../models/Pharmacy.js";
import Medicine from "../models/Medicine.js";
import Inventory from "../models/Inventory.js";
import Request from "../models/Request.js";
import Sale from "../models/Sale.js";

export async function dashboard(req, res, next) {
  try {
    const now = new Date();
    const nearExpiry = new Date(now);
    nearExpiry.setDate(nearExpiry.getDate() + 30);
    const [users, activeUsers, suspendedUsers, pharmacies, approvedPharmacies, pendingPharmacies,
      rejectedPharmacies, medicines, inventory, outOfStock, expired, nearExpiryStock,
      requests, pendingRequests, sales, completedSales] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      Pharmacy.countDocuments(),
      Pharmacy.countDocuments({ verificationStatus: "APPROVED" }),
      Pharmacy.countDocuments({ verificationStatus: "PENDING" }),
      Pharmacy.countDocuments({ verificationStatus: "REJECTED" }),
      Medicine.countDocuments(),
      Inventory.countDocuments(),
      Inventory.countDocuments({ quantity: 0 }),
      Inventory.countDocuments({ expiryDate: { $lte: now } }),
      Inventory.countDocuments({ expiryDate: { $gt: now, $lte: nearExpiry }, quantity: { $gt: 0 } }),
      Request.countDocuments(),
      Request.countDocuments({ status: "PENDING" }),
      Sale.countDocuments(),
      Sale.countDocuments({ status: "COMPLETED" })
    ]);
    res.json({
      success: true,
      data: {
        users, activeUsers, suspendedUsers, pharmacies, approvedPharmacies, pendingPharmacies,
        rejectedPharmacies, medicines, inventory, outOfStock, expired, nearExpiryStock,
        requests, pendingRequests, sales, completedSales
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function users(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.role) filter.role = String(req.query.role).toUpperCase();
    if (req.query.status === "active") filter.isActive = true;
    if (req.query.status === "suspended") filter.isActive = false;
    if (req.query.q) {
      const escaped = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: new RegExp(escaped, "i") },
        { email: new RegExp(escaped, "i") }
      ];
    }
    const [items, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter)
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function createAdmin(req, res, next) {
  try {
    const email = req.body.email.toLowerCase();
    const existing = await User.findOne({ email }).select("_id");
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const user = await User.create({
      name: req.body.name,
      email,
      phone: req.body.phone,
      password: req.body.password,
      role: "ADMIN"
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function setUserStatus(req, res, next) {
  try {
    if (typeof req.body.isActive !== "boolean") return res.status(422).json({ success: false, message: "isActive must be a boolean" });
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
  } catch (error) {
    next(error);
  }
}

export async function adminPharmacies(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.verificationStatus = String(req.query.status).toUpperCase();
    if (req.query.q) {
      const escaped = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { pharmacyName: new RegExp(escaped, "i") },
        { city: new RegExp(escaped, "i") },
        { licenseNumber: new RegExp(escaped, "i") }
      ];
    }
    const items = await Pharmacy.find(filter).populate("ownerId", "name email isActive").sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function adminMedicines(req, res, next) {
  try {
    const items = await Medicine.find().sort({ medicineName: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function reports(req, res, next) {
  try {
    const now = new Date();
    const nearExpiry = new Date(now);
    nearExpiry.setDate(nearExpiry.getDate() + 30);
    const [requestsByStatus, pharmaciesByStatus, usersByRole, lowStock, expired,
      nearExpiryStock, salesByStatus, inventoryValue, recentUsers, recentPharmacies] = await Promise.all([
      Request.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Pharmacy.aggregate([{ $group: { _id: "$verificationStatus", count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Inventory.countDocuments({ quantity: { $gt: 0, $lte: 10 } }),
      Inventory.countDocuments({ expiryDate: { $lte: now } }),
      Inventory.countDocuments({ expiryDate: { $gt: now, $lte: nearExpiry }, quantity: { $gt: 0 } }),
      Sale.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Inventory.aggregate([
        { $match: { quantity: { $gt: 0 } } },
        { $group: { _id: null, value: { $sum: { $multiply: ["$quantity", "$price"] } } } }
      ]),
      User.find().select("name email role isActive createdAt").sort({ createdAt: -1 }).limit(8),
      Pharmacy.find().select("pharmacyName city verificationStatus createdAt").populate("ownerId", "name email").sort({ createdAt: -1 }).limit(8)
    ]);
    res.json({
      success: true,
      data: {
        requestsByStatus, pharmaciesByStatus, usersByRole, lowStock, expired,
        nearExpiryStock, salesByStatus,
        inventoryValue: inventoryValue[0]?.value || 0,
        recentUsers, recentPharmacies
      }
    });
  } catch (error) {
    next(error);
  }
}
