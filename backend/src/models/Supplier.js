import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  contactName: { type: String, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, lowercase: true, trim: true, maxlength: 254 },
  address: { type: String, trim: true, maxlength: 300 },
  notes: { type: String, trim: true, maxlength: 1000 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

supplierSchema.index({ pharmacyId: 1, name: 1 }, { unique: true });

export default mongoose.model("Supplier", supplierSchema);
