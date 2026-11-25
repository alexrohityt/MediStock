import User from "../models/User.js";
import Pharmacy from "../models/Pharmacy.js";

const allowedPermissions = new Set(["dashboard", "inventory", "requests", "procurement", "sales", "prescriptions"]);

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.some((permission) => !allowedPermissions.has(permission))) return null;
  return [...new Set(["dashboard", ...permissions])];
}

function staffResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    permissions: user.permissions,
    createdAt: user.createdAt
  };
}

export async function listStaff(req, res, next) {
  try {
    const pharmacy = await Pharmacy.findOne({ ownerId: req.user._id });
    if (!pharmacy) return res.json({ success: true, data: [] });
    const staff = await User.find({ pharmacyId: pharmacy._id, role: "STAFF" }).sort({ name: 1 });
    res.json({ success: true, data: staff.map(staffResponse) });
  } catch (error) {
    next(error);
  }
}

export async function createStaff(req, res, next) {
  try {
    const pharmacy = await Pharmacy.findOne({ ownerId: req.user._id });
    if (!pharmacy) return res.status(404).json({ success: false, message: "Create a pharmacy profile first" });
    const { name, email, password, phone } = req.body;
    if (!name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") || typeof password !== "string" || password.length < 8) {
      return res.status(422).json({ success: false, message: "Name, valid email and a password of at least 8 characters are required" });
    }
    const permissions = normalizePermissions(req.body.permissions || []);
    if (!permissions) return res.status(422).json({ success: false, message: "One or more staff permissions are invalid" });
    const staff = await User.create({ name, email, password, phone, role: "STAFF", pharmacyId: pharmacy._id, permissions });
    res.status(201).json({ success: true, data: staffResponse(staff) });
  } catch (error) {
    next(error);
  }
}

export async function updateStaff(req, res, next) {
  try {
    const pharmacy = await Pharmacy.findOne({ ownerId: req.user._id });
    if (!pharmacy) return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    const staff = await User.findOne({ _id: req.params.id, pharmacyId: pharmacy._id, role: "STAFF" });
    if (!staff) return res.status(404).json({ success: false, message: "Staff account not found" });
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") return res.status(422).json({ success: false, message: "isActive must be a boolean" });
      staff.isActive = req.body.isActive;
    }
    if (req.body.permissions !== undefined) {
      const permissions = normalizePermissions(req.body.permissions);
      if (!permissions) return res.status(422).json({ success: false, message: "One or more staff permissions are invalid" });
      staff.permissions = permissions;
    }
    await staff.save();
    res.json({ success: true, data: staffResponse(staff) });
  } catch (error) {
    next(error);
  }
}
