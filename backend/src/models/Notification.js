import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  dedupeKey: { type: String, select: false },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("Notification", notificationSchema);
