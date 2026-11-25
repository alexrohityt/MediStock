import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const prescriptionWorkflowSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true, index: true },
  reference: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true, trim: true, maxlength: 120 },
  customerPhone: { type: String, required: true, trim: true, maxlength: 20 },
  status: { type: String, enum: ["RECEIVED", "UNDER_REVIEW", "READY_FOR_PICKUP", "COMPLETED", "REJECTED", "CANCELLED"], default: "RECEIVED", index: true },
  statusHistory: { type: [eventSchema], default: [] }
}, { timestamps: true });

prescriptionWorkflowSchema.index({ pharmacyId: 1, createdAt: -1 });

export default mongoose.model("PrescriptionWorkflow", prescriptionWorkflowSchema);
