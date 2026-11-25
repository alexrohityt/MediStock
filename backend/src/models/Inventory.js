import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema({
  operationId: { type: String, required: true },
  quantityChange: { type: Number, required: true, validate: Number.isInteger },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true, index: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true, index: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  reorderLevel: { type: Number, required: true, min: 0, default: 10 },
  price: { type: Number, required: true, min: 0 },
  batchNumber: { type: String, required: true, trim: true, maxlength: 100 },
  expiryDate: { type: Date, required: true },
  availabilityStatus: { type: String, enum: ["AVAILABLE", "OUT_OF_STOCK", "EXPIRED", "DISCONTINUED"], default: "AVAILABLE" },
  stockMovements: { type: [stockMovementSchema], default: [] },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

inventorySchema.index({ pharmacyId: 1, medicineId: 1, batchNumber: 1 }, { unique: true });

export default mongoose.model("Inventory", inventorySchema);
