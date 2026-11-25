import mongoose from "mongoose";

const requestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true, index: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true, index: true },
  inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
  requestedQuantity: { type: Number, required: true, min: 1, max: 1000 },
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "FULFILLED", "CANCELLED"], default: "PENDING", index: true },
  fulfillmentType: { type: String, enum: ["PICKUP", "DELIVERY"], default: "PICKUP" },
  deliveryAddress: {
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: { type: String, trim: true, maxlength: 12 },
    instructions: { type: String, trim: true, maxlength: 500 }
  },
  unitPrice: { type: Number, min: 0 },
  prescription: {
    fileId: { type: String, select: false },
    mimeType: { type: String, enum: ["application/pdf", "image/jpeg", "image/png"] },
    uploadedAt: { type: Date }
  },
  remarks: { type: String, trim: true, maxlength: 1000, default: "" }
}, {
  timestamps: true,
  toJSON: {
    transform(_document, value) {
      if (value.prescription) delete value.prescription.fileId;
      return value;
    }
  }
});

export default mongoose.model("Request", requestSchema);
