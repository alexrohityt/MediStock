import Notification from "../models/Notification.js";

export async function listNotifications(req, res, next) {
  try {
    const items = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}
