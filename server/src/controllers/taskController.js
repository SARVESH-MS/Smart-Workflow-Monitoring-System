import dayjs from "dayjs";
import { z } from "zod";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { startTimer, stopTimer, markDelay, endOtherActiveTasks } from "../services/timeService.js";
import { notifyDelay, notifyComplete, notifyDelaySms, notifyAssigned } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";

const taskSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  title: z.string().min(3),
  description: z.string().optional(),
  roleContribution: z.string().optional(),
  deadline: z.string()
});

const taskUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  roleContribution: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  deadline: z.string().optional(),
  userId: z.string().optional(),
  stage: z.string().optional(),
  dependencies: z.array(z.string()).optional()
});

const progressLogSchema = z.object({
  workType: z.enum([
    "design",
    "frontend",
    "backend",
    "testing",
    "documentation",
    "integration",
    "bugfix",
    "review",
    "deployment",
    "research",
    "other"
  ]),
  affectedArea: z.string().trim().min(3).max(160),
  progressState: z.enum(["started", "partial", "completed", "blocked"]),
  evidenceType: z.enum(["none", "commit", "screenshot", "preview", "figma", "api_test", "document", "issue", "other"]),
  note: z.string().trim().min(10).max(1200),
  evidenceUrl: z.string().trim().url().optional().or(z.literal(""))
});

const getTodayKey = () => dayjs().format("YYYY-MM-DD");
const PROGRESS_REVIEW_WINDOW_DAYS = 7;
const HIGH_SIMILARITY_THRESHOLD = 0.84;
const MEDIUM_SIMILARITY_THRESHOLD = 0.68;

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toTokenSet = (value) =>
  new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );

const getTokenSimilarity = (left, right) => {
  const leftTokens = toTokenSet(left);
  const rightTokens = toTokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const normalizeEvidenceUrl = (value) => String(value || "").trim().toLowerCase();

const getRecentProgressLogs = (progressLogs = []) => {
  const cutoff = dayjs().subtract(PROGRESS_REVIEW_WINDOW_DAYS, "day");
  return [...(Array.isArray(progressLogs) ? progressLogs : [])]
    .filter((log) => log?.loggedAt && dayjs(log.loggedAt).isAfter(cutoff))
    .sort((left, right) => new Date(left.loggedAt) - new Date(right.loggedAt));
};

const buildProgressReview = (progressLogs = []) => {
  const recentLogs = getRecentProgressLogs(progressLogs);
  const latest = recentLogs[recentLogs.length - 1] || null;

  const review = {
    windowDays: PROGRESS_REVIEW_WINDOW_DAYS,
    checkedLogs: recentLogs.length,
    riskLevel: "none",
    flags: [],
    repeatedEvidenceCount: 0,
    similarUpdateCount: 0,
    repeatedAreaCount: 0,
    latestSimilarityScore: 0
  };

  if (!latest || recentLogs.length <= 1) {
    return review;
  }

  const previousLogs = recentLogs.slice(0, -1);
  const latestText = `${latest.affectedArea || ""} ${latest.note || ""}`;
  const latestEvidenceUrl = normalizeEvidenceUrl(latest.evidenceUrl);
  const latestArea = normalizeText(latest.affectedArea);
  const latestWorkType = String(latest.workType || "").trim().toLowerCase();

  const exactDuplicateMatches = [];
  const similarMatches = [];
  const repeatedAreaMatches = [];
  const reusedEvidenceMatches = [];

  previousLogs.forEach((candidate) => {
    const candidateText = `${candidate.affectedArea || ""} ${candidate.note || ""}`;
    const similarity = getTokenSimilarity(latestText, candidateText);
    const sameArea = latestArea && latestArea === normalizeText(candidate.affectedArea);
    const sameWorkType = latestWorkType && latestWorkType === String(candidate.workType || "").trim().toLowerCase();
    const candidateEvidenceUrl = normalizeEvidenceUrl(candidate.evidenceUrl);
    const sameEvidenceUrl = Boolean(latestEvidenceUrl) && latestEvidenceUrl === candidateEvidenceUrl;

    if (similarity > review.latestSimilarityScore) {
      review.latestSimilarityScore = similarity;
    }
    if (sameEvidenceUrl) {
      reusedEvidenceMatches.push(candidate);
    }
    if (sameArea && sameWorkType) {
      repeatedAreaMatches.push(candidate);
    }
    if (similarity >= HIGH_SIMILARITY_THRESHOLD && sameArea && sameWorkType) {
      exactDuplicateMatches.push(candidate);
    } else if (similarity >= MEDIUM_SIMILARITY_THRESHOLD && sameArea) {
      similarMatches.push(candidate);
    }
  });

  review.repeatedEvidenceCount = reusedEvidenceMatches.length;
  review.similarUpdateCount = exactDuplicateMatches.length + similarMatches.length;
  review.repeatedAreaCount = repeatedAreaMatches.length;

  if (exactDuplicateMatches.length > 0) {
    review.flags.push({
      type: "near_duplicate_update",
      severity: "high",
      message: "Latest update is very similar to another update from the last 7 days for the same area."
    });
  }

  if (reusedEvidenceMatches.length > 0) {
    review.flags.push({
      type: "reused_evidence",
      severity: exactDuplicateMatches.length > 0 ? "high" : "warning",
      message:
        reusedEvidenceMatches.length > 1
          ? "The same evidence link has been reused multiple times in the last 7 days."
          : "The same evidence link was reused from an earlier update in the last 7 days."
    });
  }

  if (similarMatches.length > 0 || repeatedAreaMatches.length >= 2) {
    review.flags.push({
      type: "low_change_pattern",
      severity: "warning",
      message: "Recent updates for this area look repetitive. Review whether there are major changes or just minor edits."
    });
  }

  if (review.flags.some((flag) => flag.severity === "high")) {
    review.riskLevel = "high";
  } else if (review.flags.length > 0) {
    review.riskLevel = "warning";
  }

  return review;
};

const getLatestProgressToday = (task, userId) => {
  if (!Array.isArray(task?.progressLogs)) return null;
  const todaysLogs = task.progressLogs
    .filter(
      (log) =>
        String(log.createdBy || "") === String(userId || "") &&
        dayjs(log.loggedAt).format("YYYY-MM-DD") === getTodayKey()
    )
    .sort((left, right) => new Date(right.loggedAt) - new Date(left.loggedAt));
  return todaysLogs[0] || null;
};

const buildDailyProgressStatus = (task) => {
  const latestToday = getLatestProgressToday(task, task?.userId);
  if (!latestToday) {
    return {
      state: "missing",
      label: "Missing today",
      tone: "danger",
      hasProofLink: false,
      message: "Today's progress has not been uploaded yet."
    };
  }

  const hasProofLink = Boolean(String(latestToday.evidenceUrl || "").trim());
  if (hasProofLink) {
    return {
      state: "with_proof",
      label: "Uploaded with proof",
      tone: "success",
      hasProofLink: true,
      message: "Today's progress was uploaded with a proof link."
    };
  }

  return {
    state: "without_proof",
    label: "Uploaded without proof",
    tone: "warning",
    hasProofLink: false,
    message: "Today's progress was uploaded, but no proof link was attached."
  };
};

const toTaskResponse = (task) => {
  const rawTask = typeof task?.toObject === "function" ? task.toObject() : task;
  return {
    ...rawTask,
    dailyProgressStatus: buildDailyProgressStatus(rawTask),
    progressReview: buildProgressReview(rawTask?.progressLogs)
  };
};

const hasProgressToday = (task, userId) =>
  Array.isArray(task?.progressLogs) &&
  task.progressLogs.some(
    (log) =>
      String(log.createdBy || "") === String(userId || "") &&
      dayjs(log.loggedAt).format("YYYY-MM-DD") === getTodayKey()
  );

const canManagerAccessTask = async (managerId, task) => {
  if (!task?.projectId) return false;
  const project = await Project.findOne({ _id: task.projectId, managerId }).select("_id").lean();
  return Boolean(project);
};

const ensureTaskAccess = async (req, task) => {
  if (!task) {
    return { ok: false, status: 404, message: "Task not found" };
  }
  if (req.user.role === "admin") {
    return { ok: true };
  }
  if (req.user.role === "employee") {
    return String(task.userId) === String(req.user.id)
      ? { ok: true }
      : { ok: false, status: 403, message: "Forbidden" };
  }
  if (req.user.role === "manager") {
    const allowed = await canManagerAccessTask(req.user.id, task);
    return allowed ? { ok: true } : { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: false, status: 403, message: "Forbidden" };
};

const emitTaskUpdated = (req, task) => {
  req.app.get("io").emit("task:updated", task);
};

export const createTask = async (req, res) => {
  const payload = taskSchema.parse(req.body);
  const task = await Task.create({
    ...payload,
    deadline: new Date(payload.deadline)
  });
  const [user, project] = await Promise.all([User.findById(task.userId), Project.findById(task.projectId)]);
  const manager = project?.managerId ? await User.findById(project.managerId) : null;
  await notifyAssigned({ user, manager, task, project });
  await logAudit({
    actorId: req.user?.id,
    action: "task.create",
    entityType: "Task",
    entityId: task._id,
    after: task.toObject()
  });
  req.app.get("io").emit("task:created", task);
  res.status(201).json(toTaskResponse(task));
};

export const listTasks = async (req, res) => {
  const query = {};
  if (req.query.projectId) query.projectId = req.query.projectId;
  if (req.query.userId) query.userId = req.query.userId;
  const compact = String(req.query.compact || "").toLowerCase();
  const limit = Math.min(Number(req.query.limit || 0), 2000);
  const skip = Math.max(Number(req.query.skip || 0), 0);
  if (req.user.role === "manager") {
    const projects = await Project.find({ managerId: req.user.id }).select("_id").lean();
    query.projectId = { $in: projects.map((p) => p._id) };
  }
  if (req.user.role === "employee") {
    query.userId = req.user.id;
  }
  let taskQuery = Task.find(query).sort({ createdAt: -1 });
  if (compact === "1" || compact === "true") {
    taskQuery = taskQuery.select(
      "_id projectId userId title description roleContribution stage startTime timeSpent status deadline isDelayed createdAt updatedAt progressLogs lastProgressAt"
    );
  }
  if (skip) taskQuery = taskQuery.skip(skip);
  if (limit) taskQuery = taskQuery.limit(limit);
  const tasks = await taskQuery.lean();
  res.json(tasks.map(toTaskResponse));
};

export const updateTask = async (req, res) => {
  const payload = taskUpdateSchema.parse(req.body);
  const before = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, before);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { ...payload, ...(payload.deadline ? { deadline: new Date(payload.deadline) } : {}) },
    { new: true }
  );
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  if (payload.status === "in_progress") {
    await endOtherActiveTasks(Task, task.userId, task._id);
    if (!task.startTime) {
      task.startTime = new Date();
      await task.save();
    }
  }
  const updated = await markDelay(task);
  if (payload.userId && String(payload.userId) !== String(before?.userId)) {
    const [user, project] = await Promise.all([User.findById(updated.userId), Project.findById(updated.projectId)]);
    const manager = project?.managerId ? await User.findById(project.managerId) : null;
    await notifyAssigned({ user, manager, task: updated, project });
  }
  await logAudit({
    actorId: req.user?.id,
    action: "task.update",
    entityType: "Task",
    entityId: updated._id,
    before: before?.toObject(),
    after: updated.toObject()
  });
  if (updated.isDelayed) {
    const [user, project] = await Promise.all([User.findById(updated.userId), Project.findById(updated.projectId)]);
    const manager = project?.managerId ? await User.findById(project.managerId) : null;
    await notifyDelay({ user, manager, task: updated, project });
    await notifyDelaySms({ user, manager, task: updated, project });
  }
  emitTaskUpdated(req, updated);
  res.json(toTaskResponse(updated));
};

export const addTaskProgressLog = async (req, res) => {
  const payload = progressLogSchema.parse(req.body);
  const task = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }
  if (payload.evidenceType !== "none" && !payload.evidenceUrl) {
    return res.status(400).json({ message: "Add an evidence link for the selected evidence type." });
  }
  const entry = {
    workType: payload.workType,
    affectedArea: payload.affectedArea,
    progressState: payload.progressState,
    evidenceType: payload.evidenceType,
    note: payload.note,
    evidenceUrl: payload.evidenceUrl || "",
    createdBy: req.user.id,
    loggedAt: new Date()
  };
  task.progressLogs.push(entry);
  task.lastProgressAt = entry.loggedAt;
  await task.save();
  await logAudit({
    actorId: req.user?.id,
    action: "task.progress",
    entityType: "Task",
    entityId: task._id,
    after: task.toObject(),
    meta: {
      workType: payload.workType,
      progressState: payload.progressState,
      evidenceType: payload.evidenceType,
      noteLength: payload.note.length,
      hasEvidenceUrl: Boolean(payload.evidenceUrl)
    }
  });
  emitTaskUpdated(req, task);
  res.status(201).json(toTaskResponse(task));
};

export const startTaskTimer = async (req, res) => {
  const task = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }
  await endOtherActiveTasks(Task, task.userId, task._id);
  const updated = await startTimer(task);
  await logAudit({
    actorId: req.user?.id,
    action: "task.start",
    entityType: "Task",
    entityId: updated._id,
    after: updated.toObject()
  });
  emitTaskUpdated(req, updated);
  res.json(toTaskResponse(updated));
};

export const stopTaskTimer = async (req, res) => {
  const task = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }
  if (req.user.role === "employee" && !hasProgressToday(task, req.user.id)) {
    return res.status(400).json({
      message: "Add today's progress update before stopping this task."
    });
  }
  const updated = await stopTimer(task);
  await logAudit({
    actorId: req.user?.id,
    action: "task.stop",
    entityType: "Task",
    entityId: updated._id,
    after: updated.toObject()
  });
  emitTaskUpdated(req, updated);
  res.json(toTaskResponse(updated));
};

export const completeTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }
  if (req.user.role === "employee" && !hasProgressToday(task, req.user.id)) {
    return res.status(400).json({
      message: "Add today's progress update before completing this task."
    });
  }
  task.status = "done";
  task.endTime = new Date();
  await markDelay(task);
  await task.save();
  await logAudit({
    actorId: req.user?.id,
    action: "task.complete",
    entityType: "Task",
    entityId: task._id,
    after: task.toObject()
  });
  const [user, project] = await Promise.all([User.findById(task.userId), Project.findById(task.projectId)]);
  const manager = project?.managerId ? await User.findById(project.managerId) : null;
  await notifyComplete({ user, manager, task, project });
  emitTaskUpdated(req, task);
  res.json(toTaskResponse(task));
};
