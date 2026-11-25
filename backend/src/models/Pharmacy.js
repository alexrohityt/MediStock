import mongoose from "mongoose";

const pharmacySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  pharmacyName: { type: String, required: true, trim: true, maxlength: 150 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  pincode: { type: String, required: true, trim: true, maxlength: 12 },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true, validate: { validator: (v) => v.length === 2, message: "Coordinates must be [longitude, latitude]" } }
  },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  licenseNumber: { type: String, required: true, trim: true, unique: true, index: true },
  verificationStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
  openingTime: { type: String, trim: true, default: "09:00" },
  closingTime: { type: String, trim: true, default: "21:00" }
}, { timestamps: true });

pharmacySchema.index({ location: "2dsphere" });
pharmacySchema.index({ pharmacyName: "text", city: "text" });

export default mongoose.model("Pharmacy", pharmacySchema);
