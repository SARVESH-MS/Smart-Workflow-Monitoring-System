import Notification from "../models/Notification.js";

export const listMyNotifications = async (req, res) => {
  const items = await Notification.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(items);
};

export const markRead = async (req, res) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { read: true },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Notification not found" });
  res.json(item);
};

export const listMyUnreadNotificationCount = async (req, res) => {
  const count = await Notification.countDocuments({ userId: req.user.id, read: false });
  res.json({ count });
};

export const markAllRead = async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user.id, read: false },
    { $set: { read: true } }
  );
  res.json({ updated: result.modifiedCount });
};
