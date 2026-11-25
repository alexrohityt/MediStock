import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

function publicUser(user) {
  const result = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive };
  if (user.role === "STAFF") {
    result.pharmacyId = user.pharmacyId;
    result.permissions = user.permissions;
  }
  return result;
}

export async function register(req, res, next) {
  try {
    const existing = await User.findOne({ email: req.body.email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: "An account with this email already exists" });

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      role: req.body.role || "CUSTOMER"
    });
    const token = createToken(user);
    res.status(201).json({ success: true, data: { user: publicUser(user), token } });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    if (!user.isActive) return res.status(403).json({ success: false, message: "This account has been suspended" });
    res.json({ success: true, data: { user: publicUser(user), token: createToken(user) } });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    const responseMessage = "If an account exists for that email, password reset instructions are available.";

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",")[0].trim();
      const resetUrl = `${frontendUrl}/reset-password/${token}`;

      if (process.env.NODE_ENV !== "production") {
        console.log(`Password reset link for ${user.email}: ${resetUrl}`);
        return res.json({
          success: true,
          message: "Development reset link generated.",
          data: { resetUrl }
        });
      }
    }

    res.json({ success: true, message: responseMessage });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    }).select("+password +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({ success: true, data: { user: publicUser(req.user) } });
}
