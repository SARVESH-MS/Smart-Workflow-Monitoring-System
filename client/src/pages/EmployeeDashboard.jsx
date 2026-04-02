import React, { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listTasks, getTask, startTask, stopTask, completeTask, addTaskProgress, uploadTaskEvidence } from "../api/tasks.js";
import TimerControls from "../components/TimerControls.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatDate, formatDurationHours } from "../utils/date.js";
import AvailabilityCard from "../components/AvailabilityCard.jsx";
import Modal from "../components/Modal.jsx";
import TaskProgressSummary from "../components/TaskProgressSummary.jsx";
import TaskProgressReview from "../components/TaskProgressReview.jsx";
import TaskProofHistory from "../components/TaskProofHistory.jsx";
import DailyProgressStatusBadge from "../components/DailyProgressStatusBadge.jsx";
import DisclosureIcon from "../components/DisclosureIcon.jsx";
import { createSocket } from "../utils/socket.js";
import { listMyEmailUnreadCount } from "../api/emails.js";
import { listMyNotificationUnreadCount } from "../api/notifications.js";
import { getUnreadForumCount } from "../api/forum.js";
import { getEvidenceReference, hasEvidenceReference, resolveEvidenceUrl } from "../utils/evidence.js";

const WORK_TYPE_OPTIONS = [
  { value: "design", label: "Design" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "testing", label: "Testing" },
  { value: "documentation", label: "Documentation" },
  { value: "integration", label: "Integration" },
  { value: "bugfix", label: "Bug Fix" },
  { value: "review", label: "Review" },
  { value: "deployment", label: "Deployment" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" }
];

const PROGRESS_STATE_OPTIONS = [
  { value: "started", label: "Started" },
  { value: "partial", label: "Partial" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" }
];

const EVIDENCE_TYPE_OPTIONS = [
  { value: "none", label: "No Link" },
  { value: "archive", label: "Project Archive (.zip)" },
  { value: "commit", label: "Commit" },
  { value: "screenshot", label: "Screenshot" },
  { value: "preview", label: "Preview URL" },
  { value: "figma", label: "Figma" },
  { value: "api_test", label: "API/Test" },
  { value: "document", label: "Document" },
  { value: "issue", label: "Issue/Bug" },
  { value: "other", label: "Other" }
];

const MAX_TASK_EVIDENCE_FILE_SIZE = 1000 * 1024 * 1024;

const CompletionChart = lazy(() => import("../charts/CompletionChart.jsx"));
const DelayChart = lazy(() => import("../charts/DelayChart.jsx"));

const emptyProgressDraft = () => ({
  workType: "other",
  affectedArea: "",
  progressState: "partial",
  evidenceType: "none",
  note: "",
  evidenceUrl: "",
  evidenceAttachment: null,
  evidenceFile: null
});

const inferEvidenceTypeFromFile = (file, currentType) => {
  if (!file) return currentType;
  if (currentType && currentType !== "none") return currentType;

  const fileName = String(file.name || "").toLowerCase();
  const mimeType = String(file.type || "").toLowerCase();

  if (/\.(zip|rar|7z)$/i.test(fileName)) return "archive";
  if (mimeType.startsWith("image/")) return "screenshot";
  if (/\.(pdf|doc|docx|txt|rtf|ppt|pptx|xls|xlsx|csv|json|md)$/i.test(fileName)) return "document";
  return "other";
};

const formatApiError = (error, fallbackMessage) => {
  const issues = Array.isArray(error?.response?.data?.issues) ? error.response.data.issues : [];
  if (issues.length > 0) {
    const firstIssue = issues[0];
    const fieldLabel = String(firstIssue?.path?.[0] || "")
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .trim();
    if (fieldLabel && firstIssue?.message) {
      return `${fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)}: ${firstIssue.message}`;
    }
    if (firstIssue?.message) return firstIssue.message;
  }
  return error?.response?.data?.message || fallbackMessage;
};

const EmployeeDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [unreadEmails, setUnreadEmails] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadForum, setUnreadForum] = useState(0);
  const [forumSender, setForumSender] = useState("");
  const [progressDrafts, setProgressDrafts] = useState({});
  const [submittingProgressTaskId, setSubmittingProgressTaskId] = useState("");
  const [taskFeedback, setTaskFeedback] = useState({ message: "", tone: "info", taskId: "" });
  const [activeElapsedSec, setActiveElapsedSec] = useState(0);
  const [proofHistoryTask, setProofHistoryTask] = useState(null);
  const [loadingTaskDetailsId, setLoadingTaskDetailsId] = useState("");
  const [tasksOpen, setTasksOpen] = useState(false);

  const getProgressDraft = (taskId) => ({
    ...emptyProgressDraft(),
    ...(progressDrafts[taskId] || {})
  });

  const updateProgressDraft = (taskId, patch) => {
    setProgressDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...emptyProgressDraft(),
        ...(prev[taskId] || {}),
        ...patch
      }
    }));
  };

  const showTaskFeedback = (message, tone = "info", taskId = "") => {
    setTaskFeedback({ message, tone, taskId });
  };

  const mergeTaskUpdate = (updatedTask) => {
    if (!updatedTask?._id) return;
    setTasks((prev) =>
      prev.map((task) =>
        task._id === updatedTask._id ? { ...task, ...updatedTask, _expanded: task._expanded } : task
      )
    );
  };

  const load = async () => {
    const data = await listTasks({ userId: id, compact: 1 });
    setTasks(data);
  };

  useEffect(() => {
    load();
  }, [id]);

  const loadBadges = async () => {
    const [emailsRes, notifRes, forumRes] = await Promise.all([
      listMyEmailUnreadCount(),
      listMyNotificationUnreadCount(),
      getUnreadForumCount()
    ]);
    setUnreadEmails(emailsRes.count || 0);
    setUnreadNotifications(notifRes.count || 0);
    setUnreadForum(forumRes.count || 0);
    setForumSender(forumRes.latestSenderName || "");
  };

  useEffect(() => {
    loadBadges();
    const timer = setInterval(loadBadges, 30000);
    return () => clearInterval(timer);
  }, [id]);

  useEffect(() => {
    const socket = createSocket();
    const isRelevantTask = (task) => String(task?.userId || "") === String(id);
    socket.on("task:created", (task) => {
      if (!isRelevantTask(task)) return;
      setTasks((prev) =>
        prev.some((item) => String(item._id) === String(task?._id))
          ? prev
          : [{ ...task, _expanded: false }, ...prev]
      );
    });
    socket.on("task:updated", (task) => {
      setTasks((prev) => {
        const alreadyExists = prev.some((item) => String(item._id) === String(task?._id));
        if (!isRelevantTask(task)) {
          return alreadyExists ? prev.filter((item) => String(item._id) !== String(task?._id)) : prev;
        }
        if (!alreadyExists) {
          return [{ ...task, _expanded: false }, ...prev];
        }
        return prev.map((item) =>
          String(item._id) === String(task?._id) ? { ...item, ...task } : item
        );
      });
    });
    return () => socket.disconnect();
  }, [id]);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const active = tasks.find((task) => task.status === "in_progress");

  const ensureTaskDetailsLoaded = async (taskId) => {
    const currentTask = tasks.find((task) => task._id === taskId);
    if (!currentTask?._id) return null;
    if (Array.isArray(currentTask.progressLogs)) return currentTask;
    setLoadingTaskDetailsId(taskId);
    try {
      const fullTask = await getTask(taskId);
      mergeTaskUpdate(fullTask);
      return fullTask;
    } finally {
      setLoadingTaskDetailsId("");
    }
  };

  useEffect(() => {
    if (!active?._id || Array.isArray(active.progressLogs) || loadingTaskDetailsId === active._id) return;
    ensureTaskDetailsLoaded(active._id);
  }, [active?._id, active?.progressLogs, loadingTaskDetailsId]);

  useEffect(() => {
    if (!active || !active.startTime) {
      setActiveElapsedSec(0);
      return undefined;
    }
    const tick = () => {
      const start = new Date(active.startTime).getTime();
      const now = Date.now();
      setActiveElapsedSec(Math.max(Math.floor((now - start) / 1000), 0));
    };
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [active?._id, active?.startTime]);

  const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);

  const rows = tasks.map((task) => {
    const extraMinutes = task.status === "in_progress" && task.startTime ? Math.floor(activeElapsedSec / 60) : 0;
    return {
      ...task,
      timeSpent: formatDurationHours((task.timeSpent || 0) + extraMinutes),
      deadlineLabel: formatDate(task.deadline)
    };
  });

  const changeStatus = async (task, nextStatus) => {
    showTaskFeedback("", "info", "");
    try {
      let updatedTask = null;
      if (nextStatus === "in_progress") {
        updatedTask = await startTask(task._id);
      } else if (nextStatus === "todo") {
        updatedTask = await stopTask(task._id);
      } else if (nextStatus === "done") {
        updatedTask = await completeTask(task._id);
      }
      if (updatedTask?._id) {
        mergeTaskUpdate(updatedTask);
      } else {
        load();
      }
    } catch (error) {
      showTaskFeedback(error.response?.data?.message || "Task update failed.", "error", task._id);
    }
  };

  const saveProgress = async (taskId) => {
    const draft = getProgressDraft(taskId);
    const affectedArea = String(draft.affectedArea || "").trim();
    const note = String(draft.note || "").trim();
    const evidenceUrl = String(draft.evidenceUrl || "").trim();

    if (!affectedArea) {
      showTaskFeedback("Add the page, module, screen, or area you worked on today.", "error", taskId);
      return;
    }
    if (affectedArea.length < 3) {
      showTaskFeedback("Affected area must be at least 3 characters.", "error", taskId);
      return;
    }
    if (affectedArea.length > 160) {
      showTaskFeedback("Affected area must stay within 160 characters.", "error", taskId);
      return;
    }
    if (!note) {
      showTaskFeedback("Write today's progress before saving.", "error", taskId);
      return;
    }
    if (note.length < 10) {
      showTaskFeedback("Progress note must be at least 10 characters.", "error", taskId);
      return;
    }
    if (note.length > 1200) {
      showTaskFeedback("Progress note must stay within 1200 characters.", "error", taskId);
      return;
    }
    if (evidenceUrl.length > 500) {
      showTaskFeedback("Evidence link must stay within 500 characters.", "error", taskId);
      return;
    }
    if (draft.evidenceType !== "none" && !evidenceUrl && !draft.evidenceFile && !draft.evidenceAttachment?.url) {
      showTaskFeedback("Add an evidence link or upload a file for the selected evidence type.", "error", taskId);
      return;
    }
    setSubmittingProgressTaskId(taskId);
    showTaskFeedback("", "info", "");
    try {
      let evidenceAttachment = draft.evidenceAttachment || null;
      let evidenceUrl = String(draft.evidenceUrl || "").trim();

      if (draft.evidenceFile) {
        if (draft.evidenceFile.size > MAX_TASK_EVIDENCE_FILE_SIZE) {
          showTaskFeedback("Selected file is too large. Upload a proof file up to 1000MB.", "error", taskId);
          setSubmittingProgressTaskId("");
          return;
        }
        evidenceAttachment = await uploadTaskEvidence(draft.evidenceFile);
        if (!evidenceUrl) {
          evidenceUrl = evidenceAttachment.url;
        }
      }

      const updatedTask = await addTaskProgress(taskId, {
        workType: draft.workType,
        affectedArea: draft.affectedArea,
        progressState: draft.progressState,
        evidenceType: draft.evidenceType,
        note: draft.note,
        evidenceUrl,
        evidenceAttachment
      });
      mergeTaskUpdate(updatedTask);
      setProgressDrafts((prev) => ({
        ...prev,
        [taskId]: emptyProgressDraft()
      }));
      if (updatedTask?.progressReview?.riskLevel === "high") {
        showTaskFeedback(
          "Today's progress was saved, but the submission review found strong issues. Add clearer evidence or make sure the proof matches the assigned task.",
          "warning",
          taskId
        );
      } else if (updatedTask?.progressReview?.riskLevel === "warning") {
        showTaskFeedback(
          "Today's progress was saved. Submission review suggests the latest proof may need clearer changes or better task alignment.",
          "warning",
          taskId
        );
      } else {
        showTaskFeedback("Today's progress has been saved.", "success", taskId);
      }
    } catch (error) {
      showTaskFeedback(formatApiError(error, "Saving progress failed."), "error", taskId);
    } finally {
      setSubmittingProgressTaskId("");
    }
  };

  const renderProgressForm = (task) => {
    const draft = getProgressDraft(task._id);
    const feedbackForTask = taskFeedback.message && taskFeedback.taskId === task._id ? taskFeedback : null;
    const feedbackToneClass =
      feedbackForTask?.tone === "error"
        ? "border-rose-300 bg-rose-100 text-rose-950"
        : feedbackForTask?.tone === "warning"
          ? "border-amber-300 bg-amber-100 text-amber-950"
          : "border-emerald-300 bg-emerald-100 text-emerald-950";
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Work Type</label>
            <select
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
              value={draft.workType}
              onChange={(e) => updateProgressDraft(task._id, { workType: e.target.value })}
            >
              {WORK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Progress State</label>
            <select
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
              value={draft.progressState}
              onChange={(e) => updateProgressDraft(task._id, { progressState: e.target.value })}
            >
              {PROGRESS_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="Affected area: page, module, API, component, screen, document"
          value={draft.affectedArea}
          onChange={(e) => updateProgressDraft(task._id, { affectedArea: e.target.value })}
        />

        <textarea
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="What real work did you complete today?"
          value={draft.note}
          onChange={(e) => updateProgressDraft(task._id, { note: e.target.value })}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Evidence Type</label>
            <select
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
              value={draft.evidenceType}
              onChange={(e) => updateProgressDraft(task._id, { evidenceType: e.target.value })}
            >
              {EVIDENCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">Evidence Link</label>
            <input
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
              placeholder={draft.evidenceType === "none" ? "Evidence link optional" : "Evidence link or uploaded file"}
              value={draft.evidenceUrl}
              onChange={(e) => updateProgressDraft(task._id, { evidenceUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-xs uppercase tracking-wide text-slate-500">Evidence File</label>
          <input
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-200"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.zip,.rar,.7z,.json,.md"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              if (file && file.size > MAX_TASK_EVIDENCE_FILE_SIZE) {
                showTaskFeedback("Selected file is too large. Upload a proof file up to 1000MB.", "error", task._id);
                e.target.value = "";
                return;
              }
              const nextEvidenceType = inferEvidenceTypeFromFile(file, draft.evidenceType);
              updateProgressDraft(task._id, {
                evidenceFile: file,
                evidenceAttachment: null,
                evidenceType: nextEvidenceType
              });
            }}
          />
          <div className="text-xs text-slate-500">
            Upload PDF, Word, screenshots, text, spreadsheet, or project archive files up to 1000MB. ZIP archives trigger the deepest automated project check.
          </div>
          {draft.evidenceFile ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Selected file: {draft.evidenceFile.name}</span>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                type="button"
                onClick={() => updateProgressDraft(task._id, { evidenceFile: null, evidenceAttachment: null })}
              >
                Remove file
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            type="button"
            disabled={submittingProgressTaskId === task._id}
            onClick={() => saveProgress(task._id)}
          >
            {submittingProgressTaskId === task._id ? "Saving..." : "Save Today Progress"}
          </button>
          <div className="self-center text-xs text-slate-500">
            Save a same-day update before stopping or completing the task.
          </div>
        </div>
        {feedbackForTask ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${feedbackToneClass}`}>
            {feedbackForTask.message}
          </div>
        ) : null}
      </div>
    );
  };

  const renderProofHistoryButton = (task, extraClassName = "") => {
    const proofCount = Number(task?.proofSubmissionCount || 0);
    return (
      <button
        className={`btn-ghost px-2 py-1 text-xs ${extraClassName}`.trim()}
        type="button"
        onClick={async () => {
          setProofHistoryTask({ _id: task._id, title: task.title, progressLogs: task.progressLogs || [] });
          if (Array.isArray(task.progressLogs)) return;
          setLoadingTaskDetailsId(task._id);
          try {
            const fullTask = await getTask(task._id);
            mergeTaskUpdate(fullTask);
            setProofHistoryTask(fullTask);
          } finally {
            setLoadingTaskDetailsId("");
          }
        }}
      >
        View proof history ({proofCount})
      </button>
    );
  };

  const toggleTaskExpanded = async (taskId) => {
    const currentTask = tasks.find((task) => task._id === taskId);
    if (!currentTask?._id) return;

    if (currentTask._expanded) {
      setTasks((prev) => prev.map((item) => (item._id === taskId ? { ...item, _expanded: false } : item)));
      return;
    }

    const fullTask = (await ensureTaskDetailsLoaded(taskId)) || currentTask;
    setTasks((prev) =>
      prev.map((item) =>
        item._id === taskId
          ? { ...item, ...(fullTask?._id === taskId ? fullTask : {}), _expanded: true }
          : item
      )
    );
  };

  const getTaskStatusBadgeClass = (status) => {
    if (status === "done") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    if (status === "in_progress") return "border-blue-500/25 bg-blue-500/10 text-blue-200";
    return "border-slate-600/60 bg-slate-800/80 text-slate-200";
  };

  const getTaskStatusLabel = (status) => {
    if (status === "in_progress") return "In Progress";
    if (status === "done") return "Done";
    return "Todo";
  };

  const renderTaskDetails = (task, compact = false) => (
    <div className="pl-4 sm:pl-5">
      <div className="text-xs uppercase text-slate-500">Task Details</div>
      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
        {task.description || "No details provided."}
      </div>
      <div className={`mt-5 grid gap-4 ${compact ? "" : "lg:grid-cols-[1.15fr_0.85fr]"}`.trim()}>
        <div className="min-w-0">
          <div className="text-xs uppercase text-slate-500">Add Today's Progress</div>
          <div className="mt-2">{renderProgressForm(task)}</div>
          <div className="mt-4">
            <TaskProgressReview review={task.progressReview} />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="text-xs uppercase text-slate-500">Progress Timeline</div>
          <div className="mt-2 flex min-h-[20rem] flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/20 p-2">
            <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-1 thin-scrollbar">
              {(task.progressLogs || []).length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-500">
                  No progress updates yet.
                </div>
              )}
              {[...(task.progressLogs || [])].reverse().map((log, index) => {
                const evidenceReference = getEvidenceReference(log);
                const evidenceHref = resolveEvidenceUrl(evidenceReference);
                const evidenceLabel = log?.evidenceAttachment?.filename || evidenceReference;
                const verificationTone =
                  log?.verification?.status === "pass"
                    ? "border-emerald-700/60 bg-emerald-950/70 text-emerald-100"
                    : log?.verification?.status === "fail"
                      ? "border-rose-700/60 bg-rose-950/70 text-rose-100"
                      : "border-amber-700/60 bg-amber-950/60 text-amber-100";
                return (
                  <div key={`${task._id}-progress-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <div className="text-xs text-slate-500">{new Date(log.loggedAt).toLocaleString()}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{log.workType}</span>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{log.progressState}</span>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{log.evidenceType}</span>
                      {log?.verification?.status ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${verificationTone}`}>
                          {log.verification.status}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">Area: {log.affectedArea}</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{log.note}</div>
                    {evidenceReference ? (
                      <a
                        className="mt-2 inline-block break-all text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        href={evidenceHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {evidenceLabel}
                      </a>
                    ) : null}
                    {log?.verification?.summary ? (
                      <div className="mt-2 text-xs text-slate-400">{log.verification.summary}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page grid min-w-0 gap-6">
      <div id="overview" className="grid gap-4 lg:grid-cols-[1.2fr_1fr] items-start scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Employee Dashboard</h1>
            <p className="text-slate-400">Track your tasks and time</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible pt-3 no-scrollbar sm:flex-wrap">
            <button className="btn-ghost relative shrink-0" onClick={() => navigate(`/employee/${id}/inbox`)}>
              Emails
              {unreadEmails > 0 && (
                <span className="absolute -top-2.5 right-1 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-md">
                  {unreadEmails}
                </span>
              )}
            </button>
            <button className="btn-ghost relative shrink-0" onClick={() => navigate(`/employee/${id}/notifications`)}>
              Notifications
              {unreadNotifications > 0 && (
                <span className="absolute -top-2.5 right-1 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-md">
                  {unreadNotifications}
                </span>
              )}
            </button>
            <button className="btn-ghost relative shrink-0" onClick={() => navigate(`/employee/${id}/forum`)}>
              Team Discussion
              {unreadForum > 0 && (
                <span className="absolute -top-2.5 right-1 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-md">
                  {unreadForum}
                </span>
              )}
            </button>
            {unreadForum > 0 && forumSender && <span className="shrink-0 text-xs text-amber-300">New from {forumSender}</span>}
          </div>
        </div>
        <div id="alerts" className="card">
          <h3 className="text-lg font-semibold">Upcoming Deadlines</h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            {tasks.slice(0, 3).map((task) => (
              <div key={task._id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(task.deadline)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned Tasks" value={tasks.length} />
        <StatCard label="Active Task" value={active?.title || "None"} />
        <StatCard label="Delayed" value={tasks.filter((t) => t.isDelayed).length} />
        <StatCard label="Time Spent" value={formatDurationHours(totalTimeSpent)} />
      </div>

      {taskFeedback.message && !taskFeedback.taskId && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          {taskFeedback.message}
        </div>
      )}

      {active && (
        <div className="card overflow-visible">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Current Task</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 text-2xl font-semibold text-slate-100">{active.title}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getTaskStatusBadgeClass(active.status)}`}>
                  {getTaskStatusLabel(active.status)}
                </span>
              </div>
              <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {active.description || "No task description has been added yet."}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-lg">
              <TimerControls
                running
                onStart={() => changeStatus(active, "in_progress")}
                onStop={() => changeStatus(active, "todo")}
                onComplete={() => changeStatus(active, "done")}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Deadline</div>
              <div className="mt-1 text-base font-semibold text-slate-100">{formatDate(active.deadline)}</div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live Time</div>
              <div className="mt-1 text-base font-semibold text-slate-100">
                {formatDurationHours((active.timeSpent || 0) + Math.floor(activeElapsedSec / 60))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Proof Submissions</div>
              <div className="mt-1 text-base font-semibold text-slate-100">
                {Number(active.proofSubmissionCount || 0)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Daily Progress</div>
              <div className="mt-2">
                <DailyProgressStatusBadge status={active.dailyProgressStatus} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="grid gap-5">
              <section className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest Submission</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Review your most recent update and attached proof before sending a new one.
                    </div>
                  </div>
                  {renderProofHistoryButton(active, "px-3 py-1.5")}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                  <TaskProgressSummary
                    latestProgressLog={active.latestProgressLog}
                    progressLogs={active.progressLogs}
                  />
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-5">
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Submission Review</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Automated checks compare today&apos;s proof with your full submission history.
                  </div>
                </div>
                <TaskProgressReview review={active.progressReview} />
              </section>
            </div>

            <section className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-5">
              <div className="border-b border-slate-800/80 pb-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Update Today&apos;s Progress</div>
                <div className="mt-1 text-sm text-slate-400">
                  Add a clear work note and proof so your manager can review the task professionally.
                </div>
              </div>
              <div className="mt-5">{renderProgressForm(active)}</div>
            </section>
          </div>
        </div>
      )}

      <div id="tasks" className="card dashboard-disclosure-card min-w-0 scroll-mt-6">
        <button
          className="dashboard-disclosure-trigger"
          onClick={() => setTasksOpen((prev) => !prev)}
        >
          <div className="dashboard-disclosure-copy">
            <h3 className="text-lg font-semibold">Tasks</h3>
            <p className="text-sm text-slate-400">Track assigned work, progress updates, and current task status.</p>
          </div>
          <DisclosureIcon open={tasksOpen} />
        </button>
        {tasksOpen && (
          <>
            {isMobile ? (
              <div className="mt-4 grid gap-4">
                {rows.map((task) => (
                  <div key={task._id} className="rounded-[1.5rem] border border-slate-200/10 bg-slate-950/35 p-4 shadow-sm">
                    <button
                      className="flex w-full items-start justify-between gap-3 text-left"
                      onClick={() => toggleTaskExpanded(task._id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-medium text-slate-100">{task.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{task.roleContribution || "No role provided"}</div>
                      </div>
                      <span className="text-xs text-slate-400">{task._expanded ? "v" : ">"}</span>
                    </button>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Deadline</div>
                        <div className="mt-1 text-sm text-slate-200">{task.deadlineLabel}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Time Spent</div>
                        <div className="mt-1 text-sm text-slate-200">{task.timeSpent}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Latest Progress</div>
                      <div className="mt-2">
                        {task._expanded ? (
                          loadingTaskDetailsId === task._id && !Array.isArray(task.progressLogs) ? (
                            <div className="text-sm text-slate-400">Loading task details...</div>
                          ) : (
                            <TaskProgressSummary latestProgressLog={task.latestProgressLog} progressLogs={task.progressLogs} />
                          )
                        ) : (
                          <button
                            className="text-[11px] font-medium text-brand-300"
                            type="button"
                            onClick={() => toggleTaskExpanded(task._id)}
                          >
                            Click this task to open details
                          </button>
                        )}
                      </div>
                      {task._expanded ? (
                        <>
                          <div className="mt-2">{renderProofHistoryButton(task)}</div>
                          <div className="mt-2">
                            <DailyProgressStatusBadge status={task.dailyProgressStatus} />
                          </div>
                          <TaskProgressReview review={task.progressReview} compact />
                        </>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                      <select
                        className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm"
                        value={task.status}
                        onChange={(e) => changeStatus(task, e.target.value)}
                      >
                        <option value="todo">Todo</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    {task._expanded && (
                      <div className="mt-5 border-t border-slate-800 pt-4">
                        {loadingTaskDetailsId === task._id && !Array.isArray(task.progressLogs) ? (
                          <div className="text-sm text-slate-400">Loading task details...</div>
                        ) : (
                          renderTaskDetails(task, true)
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="table-scroll mt-4 w-full overflow-x-auto overflow-y-hidden thin-scrollbar"
                style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
              >
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-3 pr-4">Task</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Deadline</th>
                      <th className="py-3 pr-4">Time Spent</th>
                      <th className="py-3 pr-4">Latest Progress</th>
                      <th className="py-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((task) => (
                      <React.Fragment key={task._id}>
                        <tr className="border-t border-slate-800">
                          <td className="py-3 pr-4 text-slate-200">
                            <button
                              className="flex items-center gap-2 text-left"
                              onClick={() => toggleTaskExpanded(task._id)}
                            >
                              <span className="text-xs text-slate-400">{task._expanded ? "v" : ">"}</span>
                              <span>{task.title}</span>
                            </button>
                          </td>
                          <td className="break-words py-3 pr-4 text-slate-200">{task.roleContribution}</td>
                          <td className="break-words py-3 pr-4 text-slate-200">{task.deadlineLabel}</td>
                          <td className="break-words py-3 pr-4 text-slate-200">{task.timeSpent}</td>
                          <td className="min-w-[14rem] break-words py-3 pr-4 text-slate-200">
                            {task._expanded ? (
                              <>
                                {loadingTaskDetailsId === task._id && !Array.isArray(task.progressLogs) ? (
                                  <div className="text-sm text-slate-400">Loading task details...</div>
                                ) : (
                                  <TaskProgressSummary latestProgressLog={task.latestProgressLog} progressLogs={task.progressLogs} />
                                )}
                                <div className="mt-2">{renderProofHistoryButton(task)}</div>
                                <div className="mt-2">
                                  <DailyProgressStatusBadge status={task.dailyProgressStatus} />
                                </div>
                                <TaskProgressReview review={task.progressReview} compact />
                              </>
                            ) : (
                              <button
                                className="text-[11px] font-medium text-brand-300"
                                type="button"
                                onClick={() => toggleTaskExpanded(task._id)}
                              >
                                Click this task to open details
                              </button>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-slate-200">
                            <select
                              className="rounded-lg bg-slate-900 px-3 py-2 text-sm"
                              value={task.status}
                              onChange={(e) => changeStatus(task, e.target.value)}
                            >
                              <option value="todo">Todo</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                            </select>
                          </td>
                        </tr>
                        {task._expanded && (
                          <tr className="border-t border-slate-800 bg-slate-900/30">
                            <td className="py-3 pr-4 text-slate-300" colSpan={6}>
                              {loadingTaskDetailsId === task._id && !Array.isArray(task.progressLogs) ? (
                                <div className="text-sm text-slate-400">Loading task details...</div>
                              ) : (
                                renderTaskDetails(task)
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<div className="card text-sm text-slate-400">Loading completion chart...</div>}>
          <CompletionChart
            completed={tasks.filter((t) => t.status === "done").length}
            total={tasks.length}
            completedTasks={tasks.filter((t) => t.status === "done")}
            remainingTasks={tasks.filter((t) => t.status !== "done")}
          />
        </Suspense>
        <Suspense fallback={<div className="card text-sm text-slate-400">Loading delay chart...</div>}>
          <DelayChart
            delayed={tasks.filter((t) => t.isDelayed).length}
            onTime={tasks.filter((t) => !t.isDelayed).length}
            delayedTasks={tasks.filter((t) => t.isDelayed)}
            onTimeTasks={tasks.filter((t) => !t.isDelayed)}
          />
        </Suspense>
      </div>

      <div id="capacity" className="scroll-mt-6">
        <AvailabilityCard />
      </div>

      <div id="reports" className="card scroll-mt-6">
        <h3 className="text-lg font-semibold">Reports</h3>
        <p className="text-sm text-slate-400">Personal task summary and performance insights.</p>
        <div className="mt-4 grid gap-2 text-sm text-slate-300">
          <div>Total Tasks: {tasks.length}</div>
          <div>Completed: {tasks.filter((t) => t.status === "done").length}</div>
          <div>In Progress: {tasks.filter((t) => t.status === "in_progress").length}</div>
        </div>
      </div>
      <Modal
        open={Boolean(proofHistoryTask)}
        title={proofHistoryTask ? `Proof History: ${proofHistoryTask.title}` : "Proof History"}
        onClose={() => setProofHistoryTask(null)}
      >
        <TaskProofHistory task={proofHistoryTask} />
      </Modal>
    </div>
  );
};

export default EmployeeDashboard;
