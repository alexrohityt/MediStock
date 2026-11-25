import { body } from "express-validator";

export const registerValidation = [
  body("name").trim().notEmpty().isLength({ max: 100 }).withMessage("Name is required"),
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body("role").optional().isIn(["CUSTOMER", "PHARMACY"]).withMessage("Invalid role")
];

export const loginValidation = [
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required")
];

export const forgotPasswordValidation = [
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required")
];

export const resetPasswordValidation = [
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
];

export const createAdminValidation = [
  body("name").trim().notEmpty().isLength({ max: 100 }).withMessage("Name is required"),
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 20 })
];
