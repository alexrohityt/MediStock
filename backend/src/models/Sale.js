import mongoose from "mongoose";

const saleLineSchema = new mongoose.Schema({
  inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  batchNumber: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  applied: { type: Boolean, default: false }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true, index: true },
  cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  idempotencyKey: { type: String, required: true },
  status: { type: String, enum: ["PROCESSING", "COMPLETED", "FAILED"], default: "PROCESSING", index: true },
  customerName: { type: String, trim: true, maxlength: 120 },
  customerPhone: { type: String, trim: true, maxlength: 20 },
  lines: { type: [saleLineSchema], required: true, validate: [(lines) => lines.length > 0, "A sale needs at least one item"] },
  subtotal: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["CASH", "CARD", "UPI", "OTHER"], required: true },
  notes: { type: String, trim: true, maxlength: 500 }
}, { timestamps: true });

saleSchema.index({ pharmacyId: 1, createdAt: -1 });
saleSchema.index({ pharmacyId: 1, idempotencyKey: 1 }, { unique: true });

export default mongoose.model("Sale", saleSchema);
