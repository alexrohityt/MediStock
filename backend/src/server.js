import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";
import pharmacyRoutes from "./routes/pharmacyRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import procurementRoutes from "./routes/procurementRoutes.js";
import posRoutes from "./routes/posRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";

const app = express();
const port = process.env.PORT || 5000;

app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin not allowed"));
  }
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, status: "ok", service: "MediStock API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/pharmacies", pharmacyRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  let status = error.status || 500;
  let message = status === 500 ? "An unexpected server error occurred" : error.message;
  if (error.code === 11000) {
    status = 409;
    message = "A record with the provided unique value already exists";
  } else if (error.name === "ValidationError") {
    status = 422;
    message = Object.values(error.errors).map((item) => item.message).join(", ");
  } else if (error.name === "CastError") {
    status = 400;
    message = `Invalid ${error.path}`;
  } else if (error.name === "VersionError") {
    status = 409;
    message = "This record changed in another request; reload and try again";
  } else if (error.message === "Origin not allowed") {
    status = 403;
    message = error.message;
  }
  res.status(status).json({
    success: false,
    message
  });
});

try {
  await connectDB();
  app.listen(port, () => {
    console.log(`MediStock API listening on port ${port}`);
  });
} catch (error) {
  console.error("Failed to start MediStock API:", error.message);
  process.exit(1);
}
