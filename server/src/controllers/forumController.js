import path from "path";
import { z } from "zod";
import ForumRoom from "../models/ForumRoom.js";
import ForumMessage from "../models/ForumMessage.js";
import ForumRead from "../models/ForumRead.js";
import User from "../models/User.js";

const messageSchema = z.object({
  roomId: z.string(),
  text: z.string().optional()
});

export const getMyRoom = async (req, res) => {
  let managerId = req.user.role === "manager" ? req.user.id : null;
  if (req.user.role === "employee") {
    const user = await User.findById(req.user.id);
    managerId = user?.managerId;
  }
  if (!managerId) {
    return res.status(400).json({ message: "No team assigned" });
  }
  let room = await ForumRoom.findOne({ managerId });
  if (!room) {
    const manager = await User.findById(managerId);
    const name = manager ? `${manager.name} Team Discussion` : "Team Discussion";
    room = await ForumRoom.create({ managerId, name });
  }
  res.json(room);
};

const resolveRoomForUser = async (req) => {
  let managerId = req.user.role === "manager" ? req.user.id : null;
  if (req.user.role === "employee") {
    const user = await User.findById(req.user.id);
    managerId = user?.managerId;
  }
  if (!managerId) return null;
  let room = await ForumRoom.findOne({ managerId });
  if (!room) {
    const manager = await User.findById(managerId);
    const name = manager ? `${manager.name} Team Discussion` : "Team Discussion";
    room = await ForumRoom.create({ managerId, name });
  }
  return room;
};

const getAuthorizedRoom = async (req, requestedRoomId) => {
  const room = await resolveRoomForUser(req);
  if (!room) return null;
  if (requestedRoomId && String(room._id) !== String(requestedRoomId)) {
    return null;
  }
  return room;
};

const emitForumRoomEvent = async (req, roomId, event, payload) => {
  const io = req.app.get("io");
  if (!io?.getUserRoom) return;
  const room = await ForumRoom.findById(roomId).select("managerId").lean();
  if (!room?.managerId) return;
  const audience = await User.find({
    $or: [{ _id: room.managerId }, { managerId: room.managerId }]
  })
    .select("_id")
    .lean();
  audience.forEach((user) => {
    io.to(io.getUserRoom(String(user._id))).emit(event, payload);
  });
};

export const listMessages = async (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) {
    return res.status(400).json({ message: "roomId is required" });
  }
  const room = await getAuthorizedRoom(req, roomId);
  if (!room) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const messages = await ForumMessage.find({ roomId: room._id })
    .sort({ createdAt: 1 })
    .populate("userId", "name email role");
  res.json(messages);
};

export const getUnreadCount = async (req, res) => {
  const room = await resolveRoomForUser(req);
  if (!room) {
    return res.status(400).json({ message: "No team assigned" });
  }
  const readState = await ForumRead.findOne({ roomId: room._id, userId: req.user.id });
  const since = readState?.lastReadAt;
  const query = {
    roomId: room._id,
    userId: { $ne: req.user.id }
  };
  if (since) {
    query.createdAt = { $gt: since };
  }
  const [count, latest] = await Promise.all([
    ForumMessage.countDocuments(query),
    ForumMessage.findOne(query).sort({ createdAt: -1 }).populate("userId", "name role")
  ]);
  res.json({
    count,
    latestSenderName: latest?.userId?.name || null
  });
};

export const markRead = async (req, res) => {
  const room = await resolveRoomForUser(req);
  if (!room) {
    return res.status(400).json({ message: "No team assigned" });
  }
  const now = new Date();
  await ForumRead.findOneAndUpdate(
    { roomId: room._id, userId: req.user.id },
    { lastReadAt: now },
    { upsert: true, new: true }
  );
  res.json({ success: true });
};

export const createMessage = async (req, res) => {
  const payload = messageSchema.parse(req.body);
  const room = await getAuthorizedRoom(req, payload.roomId);
  if (!room) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const message = await ForumMessage.create({
    roomId: room._id,
    userId: req.user.id,
    text: payload.text || ""
  });
  const populated = await message.populate("userId", "name email role");
  await emitForumRoomEvent(req, room._id, "forum:message", populated);
  res.status(201).json(populated);
};

export const updateMessage = async (req, res) => {
  const payload = z.object({ text: z.string().min(1) }).parse(req.body);
  const message = await ForumMessage.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (String(message.userId) !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  message.text = payload.text;
  message.editedAt = new Date();
  await message.save();
  const populated = await message.populate("userId", "name email role");
  await emitForumRoomEvent(req, message.roomId, "forum:message_updated", populated);
  res.json(populated);
};

export const deleteMessage = async (req, res) => {
  const message = await ForumMessage.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (String(message.userId) !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const roomId = message.roomId;
  await message.deleteOne();
  await emitForumRoomEvent(req, roomId, "forum:message_deleted", { id: req.params.id });
  res.json({ success: true });
};

export const uploadAttachment = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File is required" });
  }
  const file = req.file;
  const url = `/uploads/${path.basename(file.path)}`;
  res.status(201).json({
    url,
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
};

export const addAttachmentToMessage = async (req, res) => {
  const payload = z
    .object({
      url: z.string(),
      filename: z.string(),
      mimetype: z.string(),
      size: z.number()
    })
    .parse(req.body);

  const message = await ForumMessage.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  if (String(message.userId) !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  message.attachments.push(payload);
  await message.save();
  const populated = await message.populate("userId", "name email role");
  await emitForumRoomEvent(req, message.roomId, "forum:message_updated", populated);
  res.json(populated);
};
