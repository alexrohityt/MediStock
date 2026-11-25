import { Router } from "express";
import { register, login, me, forgotPassword, resetPassword } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation } from "../validators/authValidators.js";

const router = Router();
router.post("/register", registerValidation, validate, register);
router.post("/login", loginValidation, validate, login);
router.post("/forgot-password", forgotPasswordValidation, validate, forgotPassword);
router.post("/reset-password/:token", resetPasswordValidation, validate, resetPassword);
router.get("/me", authenticate, me);

export default router;
