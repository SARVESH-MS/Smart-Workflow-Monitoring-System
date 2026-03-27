import dayjs from "dayjs";
import fs from "fs/promises";
import { z } from "zod";
import { randomUUID } from "crypto";
import path from "path";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { startTimer, stopTimer, markDelay, endOtherActiveTasks } from "../services/timeService.js";
import { notifyDelay, notifyComplete, notifyDelaySms, notifyAssigned } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";
import { getRuntimeVerificationMode, queueRuntimeVerificationJob } from "../services/runtimeVerificationService.js";

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

const evidenceAttachmentSchema = z
  .object({
    filename: z.string().trim().min(1).max(240),
    mimetype: z.string().trim().min(1).max(160),
    size: z.number().int().positive().max(25 * 1024 * 1024),
    url: z.string().trim().min(1).max(500)
  })
  .nullable()
  .optional();

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
  evidenceUrl: z.string().trim().max(500).optional().or(z.literal("")),
  evidenceAttachment: evidenceAttachmentSchema
});

const getTodayKey = () => dayjs().format("YYYY-MM-DD");
const HIGH_SIMILARITY_THRESHOLD = 0.84;
const MEDIUM_SIMILARITY_THRESHOLD = 0.68;
const LOW_TASK_ALIGNMENT_THRESHOLD = 0.12;
const ALLOWED_UPLOAD_URL_PATTERN = /^\/uploads\//i;
const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i;
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const DOCUMENT_FILE_PATTERN = /\.(pdf|doc|docx|txt|rtf|ppt|pptx|xls|xlsx|csv)$/i;
const COMMIT_HOST_PATTERN = /(github|gitlab|bitbucket|azure)/i;
const COMMIT_PATH_PATTERN = /(\/commit\/|\/pull\/|\/merge_requests\/|\/compare\/|\/tree\/)/i;
const ISSUE_PATTERN = /(jira|linear|trello|asana|clickup|youtrack|issue|ticket|bug)/i;
const DOC_HOST_PATTERN = /(docs\.google|drive\.google|notion|onedrive|sharepoint|dropbox)/i;
const API_PROOF_PATTERN = /(postman|swagger|openapi|hoppscotch|insomnia|api)/i;
const TEXT_FILE_PATTERN = /\.(txt|md|json|csv|js|jsx|ts|tsx|html|css|scss|less|xml|yml|yaml)$/i;
const ARCHIVE_FILE_PATTERN = /\.(zip|rar|7z)$/i;
const MAX_TEXT_INSPECTION_BYTES = 60 * 1024;
const FETCH_TIMEOUT_MS = 12000;

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isAbsoluteHttpUrl = (value) => ABSOLUTE_HTTP_URL_PATTERN.test(String(value || "").trim());

const isLocalUploadUrl = (value) => ALLOWED_UPLOAD_URL_PATTERN.test(String(value || "").trim());

const isValidEvidenceReference = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  return isAbsoluteHttpUrl(text) || isLocalUploadUrl(text);
};

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

const stripHtml = (value) =>
  String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const addVerificationCheck = (checks, label, status, message) => {
  checks.push({ label, status, message });
};

const scoreVerificationStatus = (checks) => {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
};

const buildVerificationSummary = (status, checks) => {
  const failing = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  if (status === "pass") return "Automated verification passed for the submitted evidence.";
  if (status === "fail") return `Automated verification failed ${failing} check${failing === 1 ? "" : "s"}${warnings ? ` and raised ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}.`;
  return `Automated verification passed core checks but raised ${warnings} warning${warnings === 1 ? "" : "s"}.`;
};

const getUploadsRoot = () => path.resolve("uploads");

const resolveUploadedEvidencePath = (evidenceUrl) => {
  const relative = String(evidenceUrl || "").trim().replace(/^\/uploads\//i, "");
  if (!relative) return null;
  const uploadsRoot = getUploadsRoot();
  const target = path.resolve(uploadsRoot, relative);
  return target.startsWith(uploadsRoot) ? target : null;
};

const readTextSample = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return buffer.subarray(0, MAX_TEXT_INSPECTION_BYTES).toString("utf8");
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "SWMS-Proof-Verification/1.0"
      }
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const getEvidenceReference = (log = {}) => log?.evidenceAttachment?.url || log?.evidenceUrl || "";

const getAllProgressLogs = (progressLogs = []) => {
  return [...(Array.isArray(progressLogs) ? progressLogs : [])]
    .filter((log) => log?.loggedAt)
    .sort((left, right) => new Date(left.loggedAt) - new Date(right.loggedAt));
};

const getEvidenceValidityFlag = (latest) => {
  if (!latest || latest.evidenceType === "none") return null;
  const reference = String(getEvidenceReference(latest) || "").trim();
  const referenceLower = reference.toLowerCase();
  const attachmentMime = String(latest?.evidenceAttachment?.mimetype || "").toLowerCase();

  if (!reference) {
    return {
      type: "missing_evidence",
      severity: "high",
      message: "The selected evidence type needs a link or uploaded file, but no evidence was attached."
    };
  }

  if (!isValidEvidenceReference(reference)) {
    return {
      type: "invalid_evidence_reference",
      severity: "high",
      message: "The evidence reference is not valid. Use a real URL or an uploaded file."
    };
  }

  if (latest.evidenceType === "figma" && !referenceLower.includes("figma")) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "Figma evidence should point to a Figma file or prototype."
    };
  }

  if (latest.evidenceType === "commit" && !COMMIT_HOST_PATTERN.test(referenceLower) && !COMMIT_PATH_PATTERN.test(referenceLower)) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "Commit evidence should point to a repository, commit, pull request, or merge request."
    };
  }

  if (latest.evidenceType === "issue" && !ISSUE_PATTERN.test(referenceLower)) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "Issue evidence should point to a ticket, issue tracker, or bug item."
    };
  }

  if (latest.evidenceType === "preview" && isLocalUploadUrl(reference)) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "Preview evidence should usually be a live preview URL instead of an uploaded file."
    };
  }

  if (latest.evidenceType === "screenshot" && !(attachmentMime.startsWith("image/") || IMAGE_FILE_PATTERN.test(referenceLower))) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "Screenshot evidence should be an image file or image URL."
    };
  }

  if (
    latest.evidenceType === "document" &&
    !(DOCUMENT_FILE_PATTERN.test(referenceLower) || DOC_HOST_PATTERN.test(referenceLower) || attachmentMime.includes("pdf") || attachmentMime.includes("word") || attachmentMime.includes("officedocument") || attachmentMime.startsWith("text/"))
  ) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "Document evidence should be a document file, cloud document link, or PDF."
    };
  }

  if (latest.evidenceType === "api_test" && !API_PROOF_PATTERN.test(referenceLower) && !attachmentMime.includes("json") && !attachmentMime.startsWith("text/")) {
    return {
      type: "evidence_type_mismatch",
      severity: "warning",
      message: "API/Test evidence should point to API proof, test results, or exported test evidence."
    };
  }

  return null;
};

const getTaskAlignmentFlag = (task, latest, review) => {
  if (!latest) return null;
  const taskReference = `${task?.title || ""} ${task?.description || ""} ${task?.roleContribution || ""}`;
  const latestReference = `${latest?.affectedArea || ""} ${latest?.note || ""}`;
  const alignmentScore = getTokenSimilarity(taskReference, latestReference);
  review.taskAlignmentScore = alignmentScore;

  if (toTokenSet(taskReference).size === 0 || toTokenSet(latestReference).size === 0) {
    return null;
  }

  if (alignmentScore < LOW_TASK_ALIGNMENT_THRESHOLD) {
    return {
      type: "task_scope_mismatch",
      severity: "warning",
      message: "The latest progress note does not clearly match the assigned task description. Review whether the proof really covers the assigned work."
    };
  }

  return null;
};

const buildProgressReview = (task = {}) => {
  const allLogs = getAllProgressLogs(task?.progressLogs);
  const latest = allLogs[allLogs.length - 1] || null;

  const review = {
    scopeLabel: "all submissions",
    checkedLogs: allLogs.length,
    riskLevel: "none",
    flags: [],
    repeatedEvidenceCount: 0,
    similarUpdateCount: 0,
    repeatedAreaCount: 0,
    latestSimilarityScore: 0,
    taskAlignmentScore: 0
  };

  if (!latest) {
    return review;
  }

  const previousLogs = allLogs.slice(0, -1);
  const latestText = `${latest.affectedArea || ""} ${latest.note || ""}`;
  const latestEvidenceUrl = normalizeEvidenceUrl(getEvidenceReference(latest));
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
    const candidateEvidenceUrl = normalizeEvidenceUrl(getEvidenceReference(candidate));
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
      message: "The latest update is very similar to another earlier submission for the same area."
    });
  }

  if (reusedEvidenceMatches.length > 0) {
    review.flags.push({
      type: "reused_evidence",
      severity: exactDuplicateMatches.length > 0 ? "high" : "warning",
      message:
        reusedEvidenceMatches.length > 1
          ? "The same evidence was reused multiple times across the task submission history."
          : "The same evidence was reused from an earlier submission for this task."
    });
  }

  if (similarMatches.length > 0 || repeatedAreaMatches.length >= 2) {
    review.flags.push({
      type: "low_change_pattern",
      severity: "warning",
      message: "Multiple submissions for this area look repetitive across the task history. Review whether there are real changes or only minor edits."
    });
  }

  const taskAlignmentFlag = getTaskAlignmentFlag(task, latest, review);
  if (taskAlignmentFlag) {
    review.flags.push(taskAlignmentFlag);
  }

  const evidenceValidityFlag = getEvidenceValidityFlag(latest);
  if (evidenceValidityFlag) {
    review.flags.push(evidenceValidityFlag);
  }

  if (review.flags.some((flag) => flag.severity === "high")) {
    review.riskLevel = "high";
  } else if (review.flags.length > 0) {
    review.riskLevel = "warning";
  }

  return review;
};

const buildAutomatedVerification = async (task, entry) => {
  const checks = [];
  const taskReference = `${task?.title || ""} ${task?.description || ""} ${task?.roleContribution || ""}`;
  const submissionReference = `${entry?.affectedArea || ""} ${entry?.note || ""}`;
  const taskAlignmentScore = getTokenSimilarity(taskReference, submissionReference);
  const evidenceReference = String(getEvidenceReference(entry) || "").trim();
  const evidenceLower = evidenceReference.toLowerCase();
  let evidenceAlignmentScore = 0;

  if (taskAlignmentScore >= 0.18) {
    addVerificationCheck(checks, "Task alignment", "pass", "The submission note aligns with the assigned task details.");
  } else if (taskAlignmentScore >= LOW_TASK_ALIGNMENT_THRESHOLD) {
    addVerificationCheck(checks, "Task alignment", "warning", "The submission note only partially matches the assigned task details.");
  } else {
    addVerificationCheck(checks, "Task alignment", "warning", "The submission note does not clearly match the assigned task details yet. Manager review is recommended.");
  }

  const evidenceValidityFlag = getEvidenceValidityFlag(entry);
  if (evidenceValidityFlag) {
    addVerificationCheck(checks, "Evidence format", evidenceValidityFlag.severity === "high" ? "fail" : "warning", evidenceValidityFlag.message);
  } else if (evidenceReference) {
    addVerificationCheck(checks, "Evidence format", "pass", "The evidence reference format is valid.");
  } else {
    addVerificationCheck(checks, "Evidence format", "warning", "No evidence reference was attached, so automated proof verification is limited.");
  }

  if (isAbsoluteHttpUrl(evidenceReference)) {
    try {
      const response = await fetchWithTimeout(evidenceReference);
      if (!response.ok) {
        addVerificationCheck(checks, "URL reachability", "warning", `The evidence URL responded with HTTP ${response.status}, so automatic proof checking is limited.`);
      } else {
        addVerificationCheck(checks, "URL reachability", "pass", `The evidence URL responded successfully with HTTP ${response.status}.`);
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        const isTextResponse = contentType.includes("text") || contentType.includes("json") || contentType.includes("html") || contentType.includes("xml");
        if (isTextResponse) {
          const body = await response.text();
          const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
          const pageTitle = titleMatch?.[1] || "";
          const pageText = `${response.url} ${pageTitle} ${stripHtml(body).slice(0, 12000)}`;
          evidenceAlignmentScore = getTokenSimilarity(`${taskReference} ${submissionReference}`, pageText);
          if (evidenceAlignmentScore >= 0.12) {
            addVerificationCheck(checks, "Evidence content", "pass", "The live evidence content appears relevant to the assigned task.");
          } else if (evidenceAlignmentScore > 0) {
            addVerificationCheck(checks, "Evidence content", "warning", "The live evidence is reachable, but task-specific content is weak.");
          } else {
            addVerificationCheck(checks, "Evidence content", "warning", "The live evidence is reachable, but automated checks could not confirm task-specific content.");
          }
        } else {
          addVerificationCheck(checks, "Evidence content", "warning", "The evidence URL is reachable, but it is not a text page that can be deeply inspected automatically.");
        }
      }
    } catch (error) {
      addVerificationCheck(checks, "URL reachability", "warning", `The evidence URL could not be opened automatically: ${error.name === "AbortError" ? "request timed out" : "request failed"}. Manual review may still confirm the proof.`);
    }
  } else if (isLocalUploadUrl(evidenceReference)) {
    const filePath = resolveUploadedEvidencePath(evidenceReference);
    if (!filePath) {
      addVerificationCheck(checks, "Uploaded file", "fail", "The uploaded evidence path is invalid.");
    } else {
      try {
        const stats = await fs.stat(filePath);
        addVerificationCheck(checks, "Uploaded file", "pass", `The uploaded file exists (${Math.max(Math.round(stats.size / 1024), 1)} KB).`);
        const extension = path.extname(filePath).toLowerCase();
        const attachmentMime = String(entry?.evidenceAttachment?.mimetype || "").toLowerCase();
        if (TEXT_FILE_PATTERN.test(extension) || attachmentMime.startsWith("text/") || attachmentMime.includes("json") || attachmentMime.includes("javascript")) {
          const sample = await readTextSample(filePath);
          evidenceAlignmentScore = getTokenSimilarity(`${taskReference} ${submissionReference}`, sample);
          if (evidenceAlignmentScore >= 0.12) {
            addVerificationCheck(checks, "Uploaded content", "pass", "The uploaded file content appears relevant to the assigned task.");
          } else if (evidenceAlignmentScore > 0) {
            addVerificationCheck(checks, "Uploaded content", "warning", "The uploaded file was read, but alignment with the assigned task is weak.");
          } else {
            addVerificationCheck(checks, "Uploaded content", "warning", "The uploaded file was read, but automated checks could not confirm task-specific content.");
          }
        } else if (ARCHIVE_FILE_PATTERN.test(extension)) {
          addVerificationCheck(checks, "Archive execution", "pass", "The project archive was uploaded successfully. Runtime verification will continue separately.");
        } else {
          addVerificationCheck(checks, "Uploaded content", "pass", "The file format is valid. Deeper automated inspection is limited for this file type, but the proof was accepted.");
        }
      } catch {
        addVerificationCheck(checks, "Uploaded file", "fail", "The uploaded evidence file could not be opened from storage.");
      }
    }
  } else if (!evidenceReference) {
    addVerificationCheck(checks, "Proof availability", "warning", "No link or file was attached, so the submission could not be fully verified.");
  }

  const status = scoreVerificationStatus(checks);
  return {
    status,
    summary: buildVerificationSummary(status, checks),
    scope: "automated",
    checkedAt: new Date(),
    taskAlignmentScore,
    evidenceAlignmentScore,
    checks
  };
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

  const hasProofLink = Boolean(String(getEvidenceReference(latestToday) || "").trim());
  if (hasProofLink) {
    return {
      state: "with_proof",
      label: "Uploaded with proof",
      tone: "success",
      hasProofLink: true,
      message: "Today's progress was uploaded with proof evidence."
    };
  }

  return {
    state: "without_proof",
    label: "Uploaded without proof",
    tone: "warning",
    hasProofLink: false,
    message: "Today's progress was uploaded, but no proof file or proof link was attached."
  };
};

const getLatestProgressLog = (progressLogs = []) => {
  if (!Array.isArray(progressLogs) || progressLogs.length === 0) return null;
  return progressLogs[progressLogs.length - 1];
};

const getProofSubmissionCount = (progressLogs = []) =>
  Array.isArray(progressLogs)
    ? progressLogs.filter((log) => Boolean(String(getEvidenceReference(log) || "").trim())).length
    : 0;

const getFirstProgressAt = (progressLogs = []) => {
  if (!Array.isArray(progressLogs) || progressLogs.length === 0) return null;
  return progressLogs.reduce((earliest, log) => {
    const current = log?.loggedAt ? new Date(log.loggedAt) : null;
    if (!current || Number.isNaN(current.getTime())) return earliest;
    if (!earliest || current < earliest) return current;
    return earliest;
  }, null);
};

const getInferredStartFromTrackedTime = (task) => {
  const endReference = task?.endTime || task?.updatedAt;
  const trackedMinutes = Number(task?.timeSpent || 0);
  if (!endReference || !trackedMinutes) return null;
  const endDate = new Date(endReference);
  if (Number.isNaN(endDate.getTime())) return null;
  return new Date(endDate.getTime() - trackedMinutes * 60 * 1000);
};

const toTaskResponse = (task, options = {}) => {
  const rawTask = typeof task?.toObject === "function" ? task.toObject() : task;
  const firstProgressAt = getFirstProgressAt(rawTask?.progressLogs);
  const inferredStartAt = getInferredStartFromTrackedTime(rawTask);
  const inferredCompletionAt = rawTask?.endTime || (rawTask?.status === "done" ? rawTask?.updatedAt : null);
  const activityStartAtCandidates = [rawTask?.startTime, firstProgressAt, inferredStartAt]
    .concat(rawTask?.status === "done" ? [inferredCompletionAt] : [])
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  const timelineHasActivity = Boolean(
    rawTask?.startTime ||
    rawTask?.endTime ||
    rawTask?.timeSpent > 0 ||
    firstProgressAt ||
    rawTask?.status === "done"
  );
  const response = {
    ...rawTask,
    latestProgressLog: getLatestProgressLog(rawTask?.progressLogs),
    dailyProgressStatus: buildDailyProgressStatus(rawTask),
    progressReview: buildProgressReview(rawTask),
    progressLogCount: Array.isArray(rawTask?.progressLogs) ? rawTask.progressLogs.length : 0,
    proofSubmissionCount: getProofSubmissionCount(rawTask?.progressLogs),
    firstProgressAt,
    inferredStartAt,
    inferredCompletionAt,
    timelineHasActivity,
    timelineStartAt: activityStartAtCandidates[0] || null,
    timelineEndAt: inferredCompletionAt || rawTask?.deadline || rawTask?.updatedAt || rawTask?.createdAt || null
  };
  if (options.compact) {
    delete response.progressLogs;
  }
  return response;
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
      "_id projectId userId title description roleContribution stage startTime endTime timeSpent status deadline isDelayed createdAt updatedAt progressLogs lastProgressAt"
    );
  }
  if (skip) taskQuery = taskQuery.skip(skip);
  if (limit) taskQuery = taskQuery.limit(limit);
  const tasks = await taskQuery.lean();
  const isCompact = compact === "1" || compact === "true";
  res.json(tasks.map((task) => toTaskResponse(task, { compact: isCompact })));
};

export const getTask = async (req, res) => {
  const task = await Task.findById(req.params.id).lean();
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }
  return res.json(toTaskResponse(task));
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
    task.endTime = undefined;
    if (!task.startTime) {
      task.startTime = new Date();
      await task.save();
    }
  } else if (payload.status === "done") {
    task.endTime = new Date();
  } else if (payload.status === "todo") {
    task.endTime = undefined;
  }
  const updated = await markDelay(task);
  await updated.save();
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

export const uploadTaskEvidence = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Choose a file to upload." });
  }

  const file = req.file;
  const url = `/uploads/task-evidence/${path.basename(file.path)}`;
  return res.status(201).json({
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url
  });
};

export const addTaskProgressLog = async (req, res) => {
  const payload = progressLogSchema.parse(req.body);
  const task = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }

  const evidenceReference = String(payload.evidenceAttachment?.url || payload.evidenceUrl || "").trim();
  if (payload.evidenceType !== "none" && !evidenceReference) {
    return res.status(400).json({ message: "Add an evidence link or upload a file for the selected evidence type." });
  }
  if (evidenceReference && !isValidEvidenceReference(evidenceReference)) {
    return res.status(400).json({ message: "Use a valid evidence URL or uploaded file." });
  }

  const entry = {
    entryId: randomUUID(),
    workType: payload.workType,
    affectedArea: payload.affectedArea,
    progressState: payload.progressState,
    evidenceType: payload.evidenceType,
    note: payload.note,
    evidenceUrl: evidenceReference,
    evidenceAttachment: payload.evidenceAttachment || null,
    createdBy: req.user.id,
    loggedAt: new Date()
  };
  entry.verification = await buildAutomatedVerification(task, entry);
  if (getRuntimeVerificationMode(evidenceReference)) {
    entry.verification = await queueRuntimeVerificationJob(task, entry);
  }
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
      hasEvidenceUrl: Boolean(evidenceReference),
      hasEvidenceAttachment: Boolean(payload.evidenceAttachment?.url),
      verificationStatus: entry.verification?.status || "warning"
    }
  });
  emitTaskUpdated(req, task);
  res.status(201).json(toTaskResponse(task));
};

export const recheckTaskProgressProof = async (req, res) => {
  const task = await Task.findById(req.params.id);
  const access = await ensureTaskAccess(req, task);
  if (!access.ok) {
    return res.status(access.status).json({ message: access.message });
  }

  const entry = task?.progressLogs?.find((log) => log.entryId === req.params.entryId);
  if (!entry) {
    return res.status(404).json({ message: "Proof submission not found" });
  }

  const evidenceReference = String(getEvidenceReference(entry) || "").trim();
  entry.verification = await buildAutomatedVerification(task, entry);
  if (getRuntimeVerificationMode(evidenceReference)) {
    entry.verification = await queueRuntimeVerificationJob(task, entry);
  }

  await task.save();
  await logAudit({
    actorId: req.user?.id,
    action: "task.progress.recheck",
    entityType: "Task",
    entityId: task._id,
    after: task.toObject(),
    meta: {
      entryId: entry.entryId,
      evidenceType: entry.evidenceType,
      verificationStatus: entry.verification?.status || "warning"
    }
  });
  emitTaskUpdated(req, task);
  return res.json(toTaskResponse(task));
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
