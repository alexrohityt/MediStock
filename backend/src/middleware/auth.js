import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Account is unavailable" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You do not have permission for this action" });
    }
    next();
  };
}

export function authorizePharmacyPermission(permission) {
  return (req, res, next) => {
    if (req.user?.role === "PHARMACY") return next();
    if (req.user?.role === "STAFF" && req.user.permissions.includes(permission)) return next();
    return res.status(403).json({ success: false, message: "Your pharmacy account does not have permission for this action" });
  };
}

export function authorizeRequestRead(req, res, next) {
  const allowed =
    ["CUSTOMER", "PHARMACY", "ADMIN"].includes(req.user?.role) ||
    (req.user?.role === "STAFF" && req.user.permissions.includes("requests"));
  if (!allowed) {
    return res.status(403).json({ success: false, message: "You do not have permission to view requests" });
  }
  next();
}
