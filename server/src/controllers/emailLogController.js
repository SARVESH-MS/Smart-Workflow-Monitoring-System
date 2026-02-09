import EmailLog from "../models/EmailLog.js";

export const listEmailLogs = async (req, res) => {
  const logs = await EmailLog.find({}).sort({ createdAt: -1 }).limit(200);
  res.json(logs);
};

export const listMyEmails = async (req, res) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(400).json({ message: "User email not found" });
  }
  const logs = await EmailLog.find({ to: email }).sort({ createdAt: -1 }).limit(200);
  res.json(logs);
};

export const listMyUnreadEmailCount = async (req, res) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(400).json({ message: "User email not found" });
  }
  const count = await EmailLog.countDocuments({
    to: email,
    $or: [{ read: false }, { read: { $exists: false } }]
  });
  res.json({ count });
};

export const markMyEmailsRead = async (req, res) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(400).json({ message: "User email not found" });
  }
  const result = await EmailLog.updateMany(
    { to: email, $or: [{ read: false }, { read: { $exists: false } }] },
    { $set: { read: true } }
  );
  res.json({ updated: result.modifiedCount });
};
