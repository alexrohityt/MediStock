import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  medicineName: { type: String, required: true, trim: true, maxlength: 150, index: true },
  genericName: { type: String, required: true, trim: true, maxlength: 150, index: true },
  brandName: { type: String, trim: true, maxlength: 150, index: true },
  strength: { type: String, trim: true, maxlength: 50 },
  dosageForm: { type: String, trim: true, maxlength: 50 },
  manufacturer: { type: String, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 2000 },
  prescriptionRequired: { type: Boolean, default: false }
}, { timestamps: true });

medicineSchema.index({ medicineName: "text", genericName: "text", brandName: "text" });

export default mongoose.model("Medicine", medicineSchema);
