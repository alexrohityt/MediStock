import mongoose from "mongoose";

const lineSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  orderedQuantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  receivedQuantity: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
  pendingQuantity: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
  unitCost: { type: Number, required: true, min: 0 }
}, { _id: false });

const receiptSchema = new mongoose.Schema({
  receiptId: { type: String, required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  batchNumber: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  expiryDate: { type: Date, required: true },
  sellingPrice: { type: Number, required: true, min: 0 },
  reorderLevel: { type: Number, required: true, min: 0, default: 10 },
  status: { type: String, enum: ["PROCESSING", "RECEIVED"], default: "PROCESSING" }
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderNumber: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"], default: "DRAFT", index: true },
  lines: { type: [lineSchema], required: true, validate: [(lines) => lines.length > 0, "At least one order line is required"] },
  receipts: { type: [receiptSchema], default: [] },
  expectedDeliveryAt: { type: Date },
  notes: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true, optimisticConcurrency: true });

purchaseOrderSchema.index({ pharmacyId: 1, createdAt: -1 });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
