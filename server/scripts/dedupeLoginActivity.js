import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import AuditLog from "../src/models/AuditLog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const WINDOW_MS = Number(process.env.LOGIN_DEDUPE_WINDOW_MS || 10000);
const BATCH_SIZE = 500;

const buildKey = (log) => {
  const meta = log?.meta || {};
  const sessionId = String(meta.sessionId || "").trim();
  if (sessionId) return `${log.actorId}::session::${sessionId}`;
  const ip = String(meta.ip || "").trim();
  const ua = String(meta.ua || "").trim();
  return `${log.actorId}::fallback::${ip}::${ua}`;
};

const run = async () => {
  await connectDB();
  const cursor = AuditLog.find({ action: "auth.login" })
    .sort({ actorId: 1, createdAt: 1 })
    .lean()
    .cursor();

  const lastSeenByKey = new Map();
  const deleteIds = [];

  for await (const log of cursor) {
    const key = buildKey(log);
    const createdAt = new Date(log.createdAt).getTime();
    const lastSeen = lastSeenByKey.get(key);
    if (lastSeen && createdAt - lastSeen <= WINDOW_MS) {
      deleteIds.push(log._id);
    } else {
      lastSeenByKey.set(key, createdAt);
    }
  }

  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += BATCH_SIZE) {
    const chunk = deleteIds.slice(i, i + BATCH_SIZE);
    if (chunk.length === 0) continue;
    const result = await AuditLog.deleteMany({ _id: { $in: chunk } });
    deleted += result.deletedCount || 0;
  }

  console.log(`Removed ${deleted} duplicate login audit logs (window ${WINDOW_MS}ms).`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Failed to dedupe login activity", error);
  mongoose.disconnect().catch(() => null);
  process.exit(1);
});
