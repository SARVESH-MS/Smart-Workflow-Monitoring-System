import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listProjects } from "../api/projects.js";
import { listTasks, getTask, createTask, updateTask, deleteTask, recheckTaskProof } from "../api/tasks.js";
import api from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import Modal from "../components/Modal.jsx";
import { formatDate, formatDurationHours } from "../utils/date.js";
import { createSocket } from "../utils/socket.js";
import dayjs from "dayjs";
import { downloadTasksCsv, downloadTasksPdf } from "../api/reports.js";
import { listTaskTemplates, createTaskTemplate, createRecurring } from "../api/recurring.js";
import { bulkUpdateTasks } from "../api/bulk.js";
import GlobalSearch from "../components/GlobalSearch.jsx";
import AvailabilityCard from "../components/AvailabilityCard.jsx";
import PerformanceScorecard from "../components/PerformanceScorecard.jsx";
import TaskProgressSummary from "../components/TaskProgressSummary.jsx";
import TaskProgressReview from "../components/TaskProgressReview.jsx";
import DailyProgressStatusBadge from "../components/DailyProgressStatusBadge.jsx";
import TaskProofHistory from "../components/TaskProofHistory.jsx";
import DisclosureIcon from "../components/DisclosureIcon.jsx";
const DelayChart = React.lazy(() => import("../charts/DelayChart.jsx"));
const CompletionChart = React.lazy(() => import("../charts/CompletionChart.jsx"));
import { listMyEmailUnreadCount } from "../api/emails.js";
import { listMyNotificationUnreadCount } from "../api/notifications.js";
import { getUnreadForumCount } from "../api/forum.js";

const ManagerDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const raw = localStorage.getItem(`swms_selected_project_${id}`);
    return raw || "";
  });
  const [templates, setTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    roleContribution: "",
    stage: "Planning",
    estimatedDays: 3
  });
  const [recurringForm, setRecurringForm] = useState({
    templateId: "",
    projectId: "",
    userId: "",
    intervalDays: 7,
    occurrences: 5
  });
  const [filters, setFilters] = useState({ status: "", stage: "" });
  const [taskScope, setTaskScope] = useState("team");
  const [savedFilters, setSavedFilters] = useState(() => {
    const raw = localStorage.getItem("swms_manager_filters");
    return raw ? JSON.parse(raw) : [];
  });
  const [tasksOpen, setTasksOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
  const [deadlineEdits, setDeadlineEdits] = useState({});
  const [open, setOpen] = useState(false);
  const [unreadEmails, setUnreadEmails] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadForum, setUnreadForum] = useState(0);
  const [forumSender, setForumSender] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState("");
  const [dragHoverStage, setDragHoverStage] = useState("");
  const [touchDragCard, setTouchDragCard] = useState(null);
  const touchDragRef = useRef(null);
  const projectIdsRef = useRef([]);
  const [proofHistoryTask, setProofHistoryTask] = useState(null);
  const [proofHistoryLoading, setProofHistoryLoading] = useState(false);
  const [recheckingEntryId, setRecheckingEntryId] = useState("");
  const [recheckFeedback, setRecheckFeedback] = useState({ message: "", tone: "info" });
  const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState("");
  const [openProgressTaskId, setOpenProgressTaskId] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const [form, setForm] = useState({
    projectId: "",
    userId: "",
    title: "",
    description: "",
    roleContribution: "",
    deadline: ""
  });

  const loadOverview = async () => {
    const [teamData, projectsData, tasksData] = await Promise.all([
      api.get(`/api/users/team/${id}`).then((res) => res.data),
      listProjects(),
      listTasks({ compact: 1 })
    ]);
    setTeam(teamData);
    setProjects(projectsData);
    setTasks(tasksData);
    setSelectedProjectId((prev) => {
      if (prev && projectsData.some((p) => p._id === prev)) return prev;
      return projectsData.length > 0 ? projectsData[0]._id : "";
    });
  };

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
    loadOverview();
    let timeoutId;
    let idleId;
    let cancelled = false;

    const runLoadTemplates = async () => {
      try {
        const templateData = await listTaskTemplates();
        if (!cancelled) {
          setTemplates(templateData);
        }
      } catch (error) {
        if (!cancelled) {
          setTemplates([]);
        }
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runLoadTemplates, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(runLoadTemplates, 350);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [id]);
  useEffect(() => {
    loadBadges();
    const timer = setInterval(loadBadges, 30000);
    return () => clearInterval(timer);
  }, [id]);
  useEffect(() => {
    projectIdsRef.current = projects.map((project) => String(project._id));
  }, [projects]);

  useEffect(() => {
    const socket = createSocket();
    const isRelevantTask = (task) =>
      projectIdsRef.current.length === 0 || projectIdsRef.current.includes(String(task?.projectId || ""));
    const isRelevantProject = (project) => String(project?.managerId || "") === String(id);
    const isRelevantTeamMember = (member) =>
      String(member?.managerId || "") === String(id) && String(member?.role || "") === "employee";
    socket.on("task:created", (task) => {
      if (!isRelevantTask(task)) return;
      setTasks((prev) =>
        prev.some((item) => String(item._id) === String(task?._id))
          ? prev
          : [task, ...prev]
      );
    });
    socket.on("task:updated", (task) => {
      setTasks((prev) => {
        const alreadyExists = prev.some((item) => String(item._id) === String(task?._id));
        if (!isRelevantTask(task)) {
          return alreadyExists ? prev.filter((item) => String(item._id) !== String(task?._id)) : prev;
        }
        if (!alreadyExists) {
          return [task, ...prev];
        }
        return prev.map((item) => (String(item._id) === String(task?._id) ? { ...item, ...task } : item));
      });
    });
    socket.on("task:deleted", (task) => {
      const taskId = String(task?._id || "");
      if (!taskId) return;
      setTasks((prev) => prev.filter((item) => String(item._id) !== taskId));
      setSelectedTaskIds((prev) => prev.filter((id) => String(id) !== taskId));
      setOpenProgressTaskId((current) => (String(current) === taskId ? "" : current));
      setProofHistoryTask((current) => (String(current?._id || "") === taskId ? null : current));
    });
    socket.on("project:created", (project) => {
      if (!isRelevantProject(project)) return;
      setProjects((prev) =>
        prev.some((item) => String(item._id) === String(project?._id))
          ? prev
          : [project, ...prev]
      );
      setSelectedProjectId((prev) => prev || project?._id || "");
    });
    socket.on("project:updated", (project) => {
      setProjects((prev) => {
        const exists = prev.some((item) => String(item._id) === String(project?._id));
        if (!isRelevantProject(project)) {
          return exists ? prev.filter((item) => String(item._id) !== String(project?._id)) : prev;
        }
        if (!exists) {
          return [project, ...prev];
        }
        return prev.map((item) => (String(item._id) === String(project?._id) ? { ...item, ...project } : item));
      });
      if (!isRelevantProject(project)) {
        setTasks((prev) => prev.filter((task) => String(task.projectId) !== String(project?._id)));
        setSelectedProjectId((prev) => (String(prev) === String(project?._id) ? "" : prev));
        return;
      }
      setSelectedProjectId((prev) => prev || project?._id || "");
    });
    socket.on("user:created", (member) => {
      if (!isRelevantTeamMember(member)) return;
      setTeam((prev) =>
        prev.some((item) => String(item._id) === String(member.id || member._id))
          ? prev
          : [
              {
                ...member,
                _id: member.id || member._id
              },
              ...prev
            ]
      );
    });
    socket.on("user:updated", (member) => {
      const memberId = String(member?.id || member?._id || "");
      if (!memberId) return;
      setTeam((prev) => {
        const exists = prev.some((item) => String(item._id) === memberId);
        if (!isRelevantTeamMember(member)) {
          return exists ? prev.filter((item) => String(item._id) !== memberId) : prev;
        }
        if (!exists) {
          return [{ ...member, _id: member.id || member._id }, ...prev];
        }
        return prev.map((item) =>
          String(item._id) === memberId ? { ...item, ...member, _id: member.id || member._id } : item
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

  const taskColumns = useMemo(
    () => [
      { key: "select", label: "" },
      { key: "title", label: "Task" },
      { key: "assignee", label: "Assignee" },
      { key: "progress", label: "Latest Progress" },
      { key: "deadline", label: "Deadline" },
      { key: "timeSpent", label: "Time Spent" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Actions" }
    ],
    []
  );

  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const normalizeTaskStatus = (status) => String(status || "todo").trim().toLowerCase().replace(/\s+/g, "_");

  const getTaskReviewState = (task) => {
    const riskLevel = String(task.progressReview?.riskLevel || "").toLowerCase();
    if (riskLevel === "high" || riskLevel === "warning") return riskLevel;

    const hasReviewFlags = Array.isArray(task.progressReview?.flags) && task.progressReview.flags.length > 0;
    const verificationStatus = String(task.latestProgressLog?.verification?.status || "").toLowerCase();

    if (verificationStatus === "fail") return "high";
    if (verificationStatus === "warning" || hasReviewFlags) return "warning";
    return "none";
  };

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (taskScope === "mine" && String(task.userId) !== String(id)) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.stage && (task.stage || "Planning") !== filters.stage) return false;
        return true;
      }),
    [filters.stage, filters.status, id, taskScope, tasks]
  );
  const selectedTaskCount = selectedTaskIds.length;
  const activeTaskCount = useMemo(
    () => filteredTasks.filter((task) => normalizeTaskStatus(task.status) === "in_progress").length,
    [filteredTasks]
  );
  const reviewTaskCount = useMemo(
    () => filteredTasks.filter((task) => getTaskReviewState(task) !== "none").length,
    [filteredTasks]
  );
  const dueSoonTaskCount = useMemo(
    () =>
      filteredTasks.filter((task) => {
        const deadline = dayjs(getEffectiveDeadlineInput(task) || task.deadline);
        if (!deadline.isValid() || normalizeTaskStatus(task.status) === "done") return false;
        const daysLeft = deadline.startOf("day").diff(dayjs().startOf("day"), "day");
        return daysLeft >= 0 && daysLeft <= 7;
      }).length,
    [filteredTasks]
  );
  const chartTasks = useMemo(() => {
    const projectNameById = new Map(projects.map((project) => [String(project._id), project.name]));
    return tasks.map((task) => ({
      ...task,
      projectName: projectNameById.get(String(task.projectId)) || ""
    }));
  }, [projects, tasks]);
  const completedTasks = chartTasks.filter((task) => task.status === "done");
  const remainingTasks = chartTasks.filter((task) => task.status !== "done");
  const delayedTasks = chartTasks.filter((task) => task.isDelayed);
  const onTimeTasks = chartTasks.filter((task) => !task.isDelayed);

  const mergeTaskUpdate = (updatedTask) => {
    setTasks((prev) => prev.map((task) => (task._id === updatedTask._id ? { ...task, ...updatedTask } : task)));
  };

  const mergeTaskUpdates = (updatedTasks = []) => {
    if (!Array.isArray(updatedTasks) || updatedTasks.length === 0) return;
    const updatesById = new Map(updatedTasks.filter(Boolean).map((task) => [String(task._id), task]));
    setTasks((prev) =>
      prev.map((task) => {
        const next = updatesById.get(String(task._id));
        return next ? { ...task, ...next } : task;
      })
    );
  };

  const handleRecheckProof = async (taskId, entryId) => {
    if (!taskId || !entryId) return;
    setRecheckingEntryId(entryId);
    setRecheckFeedback({ message: "", tone: "info" });
    try {
      const updatedTask = await recheckTaskProof(taskId, entryId);
      mergeTaskUpdate(updatedTask);
      setProofHistoryTask((current) =>
        current && String(current._id) === String(updatedTask._id) ? updatedTask : current
      );
      setRecheckFeedback({
        message: "Proof rechecked successfully. The latest verification result has been refreshed.",
        tone: "success"
      });
    } catch (error) {
      setRecheckFeedback({
        message: error.response?.data?.message || "Proof recheck failed. Please try again.",
        tone: "error"
      });
    } finally {
      setRecheckingEntryId("");
    }
  };

  const handleManagerStatusChange = async (taskId, nextStatus) => {
    if (!taskId || !nextStatus) return;
    setStatusUpdatingTaskId(taskId);
    try {
      const updatedTask = await updateTask(taskId, { status: nextStatus });
      mergeTaskUpdate(updatedTask);
      setProofHistoryTask((current) =>
        current && String(current._id) === String(updatedTask._id) ? updatedTask : current
      );
    } finally {
      setStatusUpdatingTaskId("");
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!taskId || deletingTaskId) return;
    const confirmed = window.confirm(`Delete "${taskTitle || "this task"}"? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingTaskId(taskId);
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => String(task._id) !== String(taskId)));
      setSelectedTaskIds((prev) => prev.filter((id) => String(id) !== String(taskId)));
      setOpenProgressTaskId((current) => (String(current) === String(taskId) ? "" : current));
      setProofHistoryTask((current) => (String(current?._id || "") === String(taskId) ? null : current));
    } finally {
      setDeletingTaskId("");
    }
  };

  const getEntityId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
  };

  function getEffectiveDeadlineInput(task) {
    const originalDeadline = task.deadline ? dayjs(task.deadline).format("YYYY-MM-DD") : "";
    const editedDeadline = deadlineEdits[task._id];
    return editedDeadline && dayjs(editedDeadline).isValid() ? editedDeadline : originalDeadline;
  }

  const formatTaskStatusLabel = (status) =>
    String(status || "todo")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const formatRoleLabel = (role) =>
    String(role || "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const getTaskStatusToneClass = (status) =>
    status === "done"
      ? "border-emerald-950 bg-emerald-950/90 text-emerald-50"
      : status === "in_progress"
        ? "border-sky-950 bg-sky-950/90 text-sky-50"
        : status === "todo"
          ? "border-slate-900 bg-slate-900/90 text-slate-100"
          : "border-slate-900 bg-slate-900/90 text-slate-100";

  const taskRows = filteredTasks.map((task) => {
    const user = team.find((member) => member._id === task.userId);
    const project = projects.find((item) => getEntityId(item._id) === getEntityId(task.projectId));
    const originalDeadline = task.deadline ? dayjs(task.deadline).format("YYYY-MM-DD") : "";
    const editValue = getEffectiveDeadlineInput(task);
    const hasDeadlineEdit = editValue !== originalDeadline;
    const lastProgressAt = task.lastProgressAt ? dayjs(task.lastProgressAt) : null;
    const isMissingTodayProgress =
      task.status === "in_progress" && (!lastProgressAt || !lastProgressAt.isSame(dayjs(), "day"));
    const proofCount = Number(task.proofSubmissionCount || 0);
    const statusToneClass = getTaskStatusToneClass(task.status);
    const isStatusUpdating = statusUpdatingTaskId === task._id;
    const isDeleting = deletingTaskId === task._id;
    const isProgressOpen = openProgressTaskId === task._id;
    return {
      ...task,
      select: (
        <input
          type="checkbox"
          checked={selectedTaskIds.includes(task._id)}
          onChange={(e) =>
            setSelectedTaskIds((prev) =>
              e.target.checked ? [...prev, task._id] : prev.filter((id) => id !== task._id)
            )
          }
        />
      ),
      title: (
        <button
          type="button"
          className="min-w-[13rem] max-w-[20rem] text-left"
          onClick={() => setOpenProgressTaskId((current) => (current === task._id ? "" : task._id))}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-slate-100">{task.title}</div>
            <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
              {task.stage || "Planning"}
            </span>
          </div>
          {task.description ? (
            <div
              className="mt-1.5 text-xs leading-5 text-slate-400"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {task.description}
            </div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {project?.name ? <span>{project.name}</span> : null}
            {task.roleContribution ? (
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                {task.roleContribution}
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-[11px] font-medium text-brand-300">
            {isProgressOpen ? "Hide latest progress" : "Open latest progress"}
          </div>
        </button>
      ),
      assignee: (
        <div className="min-w-[8rem] max-w-[11rem] rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2">
          <div className="truncate whitespace-nowrap font-medium text-slate-100" title={user?.name || "-"}>
            {user?.name || "-"}
          </div>
          <div
            className="mt-0.5 truncate whitespace-nowrap text-xs text-slate-400"
            title={formatRoleLabel(user?.teamRole || task.roleContribution) || "No role set"}
          >
            {formatRoleLabel(user?.teamRole || task.roleContribution) || "No role set"}
          </div>
        </div>
      ),
      progress: (
        <div className="min-w-[13rem] rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
          {isProgressOpen ? (
            <>
              <TaskProgressSummary latestProgressLog={task.latestProgressLog} compact />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="btn-ghost px-2 py-1 text-[11px]"
                  type="button"
                  onClick={async () => {
                    setProofHistoryLoading(true);
                    setProofHistoryTask({ _id: task._id, title: task.title, progressLogs: [] });
                    try {
                      const fullTask = await getTask(task._id);
                      setProofHistoryTask(fullTask);
                    } finally {
                      setProofHistoryLoading(false);
                    }
                  }}
                >
                  View proof history ({proofCount})
                </button>
                {task.latestProgressLog?.entryId ? (
                  <button
                    className="btn-ghost px-2 py-1 text-[11px]"
                    type="button"
                    disabled={recheckingEntryId === task.latestProgressLog.entryId}
                    onClick={() => handleRecheckProof(task._id, task.latestProgressLog.entryId)}
                  >
                    {recheckingEntryId === task.latestProgressLog.entryId ? "Rechecking..." : "Recheck proof"}
                  </button>
                ) : null}
              </div>
              <div className="mt-2">
                <DailyProgressStatusBadge status={task.dailyProgressStatus} showMessage={false} />
              </div>
              <div className="mt-2">
                <TaskProgressReview review={task.progressReview} compact />
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-400">
                {task.latestProgressLog?.loggedAt
                  ? `Last update ${dayjs(task.latestProgressLog.loggedAt).format("MMM D, YYYY h:mm A")}`
                  : "No progress update yet"}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DailyProgressStatusBadge status={task.dailyProgressStatus} showMessage={false} />
                {task.progressReview?.riskLevel ? (
                  <span className="text-[11px] text-slate-500">
                    {task.progressReview.riskLevel === "high" ? "Needs review" : "Reviewed"}
                  </span>
                ) : null}
              </div>
              <button
                className="mt-3 text-[11px] font-medium text-brand-300"
                type="button"
                onClick={() => setOpenProgressTaskId(task._id)}
              >
                Click this task to open details
              </button>
            </>
          )}
        </div>
      ),
      timeSpent: (
        <div className="min-w-[7rem] rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
          <div className="text-sm font-semibold text-slate-100">{formatDurationHours(task.timeSpent || 0)}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {task.lastProgressAt ? `Updated ${dayjs(task.lastProgressAt).format("MMM D")}` : "No updates yet"}
          </div>
        </div>
      ),
      status: (
        <div className="min-w-[8rem] rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusToneClass}`}>
              {formatTaskStatusLabel(task.status)}
            </div>
            {isStatusUpdating ? (
              <span className="text-[11px] text-slate-500">Saving...</span>
            ) : null}
          </div>
          <select
            className="mt-2 w-full rounded-lg bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={task.status || "todo"}
            disabled={isStatusUpdating}
            onChange={(e) => handleManagerStatusChange(task._id, e.target.value)}
          >
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          {isMissingTodayProgress ? (
            <div className="mt-1 text-[11px] text-amber-300">No progress today.</div>
          ) : null}
          {task.progressReview?.riskLevel === "high" ? (
            <div className="mt-1 text-[11px] text-rose-300">Needs manager review.</div>
          ) : null}
        </div>
      ),
      deadline: (
        <div className="min-w-[10rem] rounded-xl border border-slate-800/80 bg-slate-950/40 p-2">
          <input
            className="w-full rounded-lg bg-slate-900 px-3 py-1.5 text-xs"
            type="date"
            value={editValue}
            onChange={(e) =>
              setDeadlineEdits((prev) => ({ ...prev, [task._id]: e.target.value }))
            }
          />
          {hasDeadlineEdit ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={async () => {
                  if (!editValue) return;
                  const updatedTask = await updateTask(task._id, { deadline: editValue });
                  mergeTaskUpdate(updatedTask);
                  setDeadlineEdits((prev) => {
                    const next = { ...prev };
                    delete next[task._id];
                    return next;
                  });
                }}
              >
                Save
              </button>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() =>
                  setDeadlineEdits((prev) => {
                    const next = { ...prev };
                    delete next[task._id];
                    return next;
                  })
                }
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-2 text-[10px] text-slate-500">{formatDate(task.deadline)}</div>
          )}
        </div>
      ),
      actions: (
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs border-rose-400/70 text-rose-300 hover:border-rose-300 hover:bg-rose-950/40 hover:text-rose-100"
          onClick={() => handleDeleteTask(task._id, task.title)}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      )
    };
  });

  const normalizeStage = (value) => String(value || "Planning").trim().toLowerCase();
  const sameStage = (left, right) => normalizeStage(left) === normalizeStage(right);

  const selectedProject = useMemo(
    () => projects.find((p) => p._id === selectedProjectId),
    [projects, selectedProjectId]
  );
  const kanbanStages = useMemo(
    () =>
      selectedProject?.workflow || [
        "Planning",
        "Design",
        "Development",
        "Testing",
        "Done"
      ],
    [selectedProject]
  );
  const projectTasks = useMemo(
    () => tasks.filter((t) => getEntityId(t.projectId) === selectedProjectId),
    [selectedProjectId, tasks]
  );
  const tasksByStage = useMemo(() => {
    const map = new Map();
    projectTasks.forEach((task) => {
      const key = normalizeStage(task.stage);
      const list = map.get(key);
      if (list) {
        list.push(task);
      } else {
        map.set(key, [task]);
      }
    });
    return map;
  }, [projectTasks]);
  const getStageTasks = (stage) => tasksByStage.get(normalizeStage(stage)) || [];

  const resetKanbanDrag = () => {
    setDraggedTaskId("");
    setDragHoverStage("");
    setTouchDragCard(null);
    touchDragRef.current = null;
  };

  const handleStageMove = async (taskId, stage) => {
    if (!taskId || !stage) {
      resetKanbanDrag();
      return;
    }
    const updatedTask = await updateTask(taskId, { stage });
    mergeTaskUpdate(updatedTask);
    resetKanbanDrag();
  };

  useEffect(() => {
    if (!touchDragCard) return undefined;

    const updateHoverStage = (clientX, clientY) => {
      const target = document.elementFromPoint(clientX, clientY);
      const stageElement = target?.closest?.("[data-kanban-stage]");
      setDragHoverStage(stageElement?.dataset?.kanbanStage || "");
      return stageElement?.dataset?.kanbanStage || "";
    };

    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      event.preventDefault();
      setTouchDragCard((prev) =>
        prev
          ? {
              ...prev,
              x: touch.clientX,
              y: touch.clientY
            }
          : prev
      );
      updateHoverStage(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = async (event) => {
      const touch = event.changedTouches?.[0];
      const taskId = touchDragRef.current?.taskId;
      const nextStage = touch ? updateHoverStage(touch.clientX, touch.clientY) : "";
      if (taskId && nextStage) {
        await handleStageMove(taskId, nextStage);
        return;
      }
      resetKanbanDrag();
    };

    const handleTouchCancel = () => {
      resetKanbanDrag();
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: false });

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [touchDragCard]);

  const deadlineChartToday = dayjs().startOf("day");

  const deadlineChartTasks = useMemo(
    () =>
      [...tasks]
        .map((task) => {
          const assignedAt = dayjs(task.createdAt || task.updatedAt || task.deadline).startOf("day");
          const deadlineSource = getEffectiveDeadlineInput(task) || task.deadline;
          const deadlineAt = dayjs(deadlineSource).endOf("day");
          const projectName =
            projects.find((project) => String(project._id) === String(getEntityId(task.projectId)))?.name || "-";
          const totalWindowDays = Math.max(deadlineAt.startOf("day").diff(assignedAt.startOf("day"), "day"), 1);
          const activeWindowStart = assignedAt.isAfter(deadlineChartToday) ? assignedAt.startOf("day") : deadlineChartToday;
          const remainingWindowDays = Math.max(deadlineAt.startOf("day").diff(activeWindowStart, "day"), 0);
          const daysRemaining = Math.max(deadlineAt.startOf("day").diff(deadlineChartToday, "day"), 0);
          const originalDeadline = task.deadline ? dayjs(task.deadline).format("YYYY-MM-DD") : "";
          return {
            ...task,
            assignedAt: assignedAt.isValid() ? assignedAt : null,
            deadlineAt: deadlineAt.isValid() ? deadlineAt : null,
            totalWindowDays,
            remainingWindowDays,
            remainingRatio: Math.max(Math.min(remainingWindowDays / totalWindowDays, 1), 0),
            daysRemaining,
            projectName,
            hasPendingDeadlineEdit: Boolean(deadlineSource && deadlineSource !== originalDeadline),
            assigneeName: team.find((member) => member._id === task.userId)?.name || "-"
          };
        })
        .filter((task) => task.assignedAt?.isValid() && task.deadlineAt?.isValid())
        .sort((left, right) => {
          const assignedDiff = right.assignedAt.valueOf() - left.assignedAt.valueOf();
          if (assignedDiff !== 0) return assignedDiff;
          return right.deadlineAt.valueOf() - left.deadlineAt.valueOf();
        }),
    [deadlineChartToday, deadlineEdits, projects, tasks, team]
  );

  const deadlineChartMaxDeadline = useMemo(
    () =>
      deadlineChartTasks.reduce((max, task) => {
        if (!task.deadlineAt?.isValid()) return max;
        if (!max || task.deadlineAt.isAfter(max)) return task.deadlineAt;
        return max;
      }, null),
    [deadlineChartTasks]
  );

  const handleAssign = async (e) => {
    e.preventDefault();
    const createdTask = await createTask(form);
    setTasks((prev) => [createdTask, ...prev]);
    setOpen(false);
    setForm({ projectId: "", userId: "", title: "", description: "", roleContribution: "", deadline: "" });
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-page grid min-w-0 gap-6">
      <div id="overview" className="flex flex-wrap items-center justify-between gap-4 scroll-mt-6">
        <div>
          <h1 className="text-3xl font-semibold">Manager Dashboard</h1>
          <p className="text-slate-400">Team overview and task assignments</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible pt-3 no-scrollbar sm:flex-wrap">
          <button className="btn-ghost relative shrink-0" onClick={() => navigate(`/manager/${id}/inbox`)}>
            Emails
            {unreadEmails > 0 && (
              <span className="absolute -top-2.5 right-1 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-md">
                {unreadEmails}
              </span>
            )}
          </button>
          <button className="btn-ghost relative shrink-0" onClick={() => navigate(`/manager/${id}/notifications`)}>
            Notifications
            {unreadNotifications > 0 && (
              <span className="absolute -top-2.5 right-1 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-md">
                {unreadNotifications}
              </span>
            )}
          </button>
          <button className="btn-ghost relative shrink-0" onClick={() => navigate(`/manager/${id}/forum`)}>
            Team Discussion
            {unreadForum > 0 && (
              <span className="absolute -top-2.5 right-1 z-10 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-md">
                {unreadForum}
              </span>
            )}
          </button>
          {unreadForum > 0 && forumSender && (
            <span className="shrink-0 text-xs text-amber-300">New from {forumSender}</span>
          )}
          <button className="btn-primary shrink-0" onClick={() => setOpen(true)}>Assign Task</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Team Members" value={team.length} />
        <StatCard label="Active Projects" value={projects.length} />
        <StatCard label="Total Tasks" value={tasks.length} />
        <StatCard label="Time Spent" value={formatDurationHours(totalTimeSpent)} />
      </div>

      <div id="tasks-search" className="scroll-mt-6">
        <GlobalSearch />
      </div>

      <div id="team" className="grid gap-4 lg:grid-cols-2 scroll-mt-6">
        <div className="card">
          <h3 className="text-lg font-semibold">Team Members</h3>
          <div className="mt-4 grid gap-2 text-sm">
            {team.map((member) => (
              <div key={member._id} className="flex items-center justify-between">
                <span>{member.name}</span>
                <span className="text-xs text-slate-400">{formatRoleLabel(member.teamRole)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <div className="card h-fit self-start">
            <h3 className="text-lg font-semibold">Team Snapshot</h3>
            <p className="text-sm text-slate-400">Quick status of team workflow health.</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <div>Team members: {team.length}</div>
              <div>Total tasks: {tasks.length}</div>
              <div>Time spent: {formatDurationHours(totalTimeSpent)}</div>
            </div>
          </div>
          <div className="h-fit self-start">
            <PerformanceScorecard />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<div className="card min-h-[260px] text-sm text-slate-400">Loading chart...</div>}>
          <DelayChart
            className="min-h-[260px]"
            delayed={delayedTasks.length}
            onTime={onTimeTasks.length}
            delayedTasks={delayedTasks}
            onTimeTasks={onTimeTasks}
          />
        </Suspense>
        <Suspense fallback={<div className="card min-h-[260px] text-sm text-slate-400">Loading chart...</div>}>
          <CompletionChart
            className="min-h-[260px]"
            completed={completedTasks.length}
            total={chartTasks.length}
            completedTasks={completedTasks}
            remainingTasks={remainingTasks}
          />
        </Suspense>
      </div>

      <div id="reports" className="card scroll-mt-6">
        <h3 className="text-lg font-semibold">Reports</h3>
        <p className="text-sm text-slate-400">Export current workflow tasks for sharing and reviews.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="btn-ghost"
            onClick={async () => triggerDownload(await downloadTasksCsv(), "tasks-report.csv")}
          >
            Export CSV
          </button>
          <button
            className="btn-ghost"
            onClick={async () => triggerDownload(await downloadTasksPdf(), "tasks-report.pdf")}
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="card dashboard-stat-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Visible Tasks</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{filteredTasks.length}</div>
        </div>
        <div className="card dashboard-stat-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">In Progress</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{activeTaskCount}</div>
        </div>
        <div className="card dashboard-stat-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Needs Review</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{reviewTaskCount}</div>
        </div>
        <div className="card dashboard-stat-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Due Soon</div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">{dueSoonTaskCount}</div>
        </div>
      </div>

      <div id="tasks" className="card dashboard-disclosure-card scroll-mt-6">
        <button
          className="dashboard-disclosure-trigger"
          onClick={() => setTasksOpen((prev) => !prev)}
        >
          <div className="dashboard-disclosure-copy">
            <h3 className="text-lg font-semibold">Tasks</h3>
            <p className="text-sm text-slate-400">Review team tasks, filters, progress, and bulk actions.</p>
          </div>
          <DisclosureIcon open={tasksOpen} />
        </button>
        {tasksOpen && (
          <>
        {recheckFeedback.message ? (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              recheckFeedback.tone === "error"
                ? "border-rose-300 bg-rose-100 text-rose-950"
                : "border-emerald-300 bg-emerald-100 text-emerald-950"
            }`}
          >
            {recheckFeedback.message}
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">View & Filters</div>
            <div className="mt-1 text-sm text-slate-400">Refine the task list by ownership, status, and workflow stage.</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                value={taskScope}
                onChange={(e) => setTaskScope(e.target.value)}
              >
                <option value="team">All Team Tasks</option>
                <option value="mine">Tasks Assigned To Me</option>
              </select>
              <select
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All Status</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                value={filters.stage}
                onChange={(e) => setFilters((prev) => ({ ...prev, stage: e.target.value }))}
              >
                <option value="">All Stages</option>
                {kanbanStages.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
              <button
                className="btn-ghost"
                onClick={() => {
                  const name = prompt("Save filter name?");
                  if (!name) return;
                  const next = [...savedFilters, { name, filters }];
                  setSavedFilters(next);
                  localStorage.setItem("swms_manager_filters", JSON.stringify(next));
                }}
              >
                Save Filter
              </button>
              <select
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                onChange={(e) => {
                  const selected = savedFilters.find((f) => f.name === e.target.value);
                  if (selected) setFilters(selected.filters);
                }}
              >
                <option value="">Load Saved Filter</option>
                {savedFilters.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/45 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bulk Actions</div>
            <div className="mt-1 text-sm text-slate-400">
              {selectedTaskCount > 0
                ? `${selectedTaskCount} task${selectedTaskCount === 1 ? "" : "s"} selected for manager actions.`
                : "Select tasks from the list to update multiple assignments at once."}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-ghost"
                onClick={async () => {
                  if (selectedTaskIds.length === 0) return;
                  const result = await bulkUpdateTasks({ taskIds: selectedTaskIds, update: { status: "in_progress" } });
                  mergeTaskUpdates(result?.tasks);
                  setSelectedTaskIds([]);
                }}
              >
                Bulk In Progress
              </button>
              <button
                className="btn-ghost"
                onClick={async () => {
                  if (selectedTaskIds.length === 0) return;
                  const result = await bulkUpdateTasks({ taskIds: selectedTaskIds, update: { status: "done" } });
                  mergeTaskUpdates(result?.tasks);
                  setSelectedTaskIds([]);
                }}
              >
                Bulk Done
              </button>
            </div>
          </div>
        </div>
        {isMobile ? (
          <div className="mt-4 grid gap-4">
            {taskRows.map((task) => (
              <div key={task._id} className="rounded-[1.5rem] border border-slate-200/10 bg-slate-950/35 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2">{task.title}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Assignee</div>
                    <div className="mt-1 text-sm text-slate-200">{task.assignee}</div>
                  </div>
                  <div className="shrink-0 pt-1">{task.select}</div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Deadline</div>
                    <div className="mt-2">{task.deadline}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Time Spent</div>
                    <div className="mt-2 text-sm text-slate-200">{task.timeSpent}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Latest Progress</div>
                  <div className="mt-2">{task.progress}</div>
                </div>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                  <div className="mt-2">{task.status}</div>
                </div>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Actions</div>
                  <div className="mt-2">{task.actions}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.75rem] border border-slate-800/80 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Task Operations</div>
                <div className="mt-1 text-xs text-slate-500">Review assignee activity, proof quality, deadlines, and current delivery status.</div>
              </div>
              <div className="text-xs text-slate-500">{filteredTasks.length} visible task{filteredTasks.length === 1 ? "" : "s"}</div>
            </div>
            <div
              className="table-scroll mt-4 w-full overflow-x-auto overflow-y-hidden thin-scrollbar"
              style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
            >
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    {taskColumns.map((col) => (
                      <th key={col.key} className="py-3 pr-4">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {taskRows.map((row) => (
                    <tr key={row.id || row._id} className="border-t border-slate-800/80">
                      {taskColumns.map((col) => (
                        <td key={col.key} className="align-top py-3 pr-4 text-slate-200">
                          {row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      <div id="projects" className="card scroll-mt-6">
        <h3 className="text-lg font-semibold">Assigned Projects</h3>
        <p className="text-sm text-slate-400">Projects assigned by Admin.</p>
        <div className="mt-4 grid gap-3">
          {projects.length === 0 && <div className="text-slate-500">No projects assigned.</div>}
          {projects.map((project) => (
            <div
              key={project._id}
              className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 sm:min-w-[220px]">
                  <div className="text-sm font-semibold text-slate-200">{project.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {project.description}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="rounded-full border border-slate-700 px-2 py-1 uppercase">
                    {project.status}
                  </div>
                  <div className="text-right">{formatDate(project.deadline)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="kanban" className="card scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Kanban Board</h3>
            <p className="text-sm text-slate-400">Drag tasks across workflow stages.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-ghost"
              onClick={async () => triggerDownload(await downloadTasksCsv(), "tasks-report.csv")}
            >
              Export CSV
            </button>
            <button
              className="btn-ghost"
              onClick={async () => triggerDownload(await downloadTasksPdf(), "tasks-report.pdf")}
            >
              Export PDF
            </button>
            <select
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm"
              value={selectedProjectId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedProjectId(value);
                localStorage.setItem(`swms_selected_project_${id}`, value);
              }}
            >
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          {kanbanStages.map((stage) => (
            <div
              key={stage}
              data-kanban-stage={stage}
              className={`rounded-xl border bg-slate-950/50 p-3 transition ${
                dragHoverStage === stage
                  ? "border-brand-400 ring-2 ring-brand-500/20"
                  : "border-slate-800"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragHoverStage((current) => (current === stage ? current : stage));
              }}
              onDragLeave={() => {
                setDragHoverStage((current) => (current === stage ? "" : current));
              }}
              onDrop={(e) => {
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) {
                  void handleStageMove(taskId, stage);
                } else {
                  resetKanbanDrag();
                }
              }}
            >
              <div className="text-xs uppercase text-slate-400">{stage}</div>
              <div className="mt-3 grid gap-2">
                {getStageTasks(stage).map((task) => (
                  <div
                    key={task._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task._id);
                      setDraggedTaskId(task._id);
                    }}
                    onDragEnd={resetKanbanDrag}
                    onTouchStart={(e) => {
                      const touch = e.touches?.[0];
                      if (!touch) return;
                      touchDragRef.current = { taskId: task._id };
                      setDraggedTaskId(task._id);
                      setTouchDragCard({
                        taskId: task._id,
                        title: task.title,
                        roleContribution: task.roleContribution,
                        x: touch.clientX,
                        y: touch.clientY
                      });
                    }}
                    className={`rounded-lg bg-slate-900 p-2 text-xs text-slate-200 transition ${
                      draggedTaskId === task._id ? "opacity-60 ring-2 ring-brand-500/30" : ""
                    }`}
                  >
                    <div className="font-semibold">{task.title}</div>
                    <div className="text-[11px] text-slate-400">{task.roleContribution}</div>
                  </div>
                ))}
                {getStageTasks(stage).length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">
                    No tasks in this stage
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {touchDragCard && (
          <div
            className="pointer-events-none fixed z-[100] w-52 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-brand-500/50 bg-slate-950/95 p-3 shadow-2xl"
            style={{ left: `${touchDragCard.x}px`, top: `${touchDragCard.y}px` }}
          >
            <div className="text-xs font-semibold text-slate-100">{touchDragCard.title}</div>
            <div className="mt-1 text-[11px] text-slate-400">
              {touchDragCard.roleContribution || "Drag to another stage"}
            </div>
          </div>
        )}
      </div>

      <div id="templates" className="card scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Task Templates & Recurring</h3>
            <p className="text-sm text-slate-400">Create reusable task templates and schedule recurring tasks.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 p-4">
            <div className="text-sm font-semibold">Create Template</div>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Template name</label>
                <input
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Weekly QA Review"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Description</label>
                <textarea
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Check staging build, run smoke tests, log bugs."
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Role</label>
                <select
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  value={templateForm.roleContribution}
                  onChange={(e) => setTemplateForm({ ...templateForm, roleContribution: e.target.value })}
                >
                  <option value="">Select role</option>
                  <option value="Designer">Designer</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Tester">Tester</option>
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Stage</label>
                <select
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  value={templateForm.stage}
                  onChange={(e) => setTemplateForm({ ...templateForm, stage: e.target.value })}
                >
                  <option value="Planning">Planning</option>
                  <option value="Design">Design</option>
                  <option value="Development">Development</option>
                  <option value="Testing">Testing</option>
                  <option value="Done">Done</option>
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Estimated days</label>
                <input
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  type="number"
                  min="1"
                  placeholder="3"
                  value={templateForm.estimatedDays}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, estimatedDays: Number(e.target.value) })
                  }
                />
                <span className="text-[11px] text-slate-500">Used to project expected duration.</span>
              </div>
              <button
                className="btn-ghost"
                onClick={async () => {
                  const created = await createTaskTemplate(templateForm);
                  setTemplates((prev) => [created, ...prev]);
                  setTemplateForm({
                    name: "",
                    description: "",
                    roleContribution: "",
                    stage: "Planning",
                    estimatedDays: 3
                  });
                }}
              >
                Save Template
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <div className="text-sm font-semibold">Create Recurring Tasks</div>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Template</label>
                <select
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  value={recurringForm.templateId}
                  onChange={(e) => setRecurringForm({ ...recurringForm, templateId: e.target.value })}
                >
                  <option value="">Select template</option>
                  {templates.map((tpl) => (
                    <option key={tpl._id} value={tpl._id}>{tpl.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Project</label>
                <select
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  value={recurringForm.projectId}
                  onChange={(e) => setRecurringForm({ ...recurringForm, projectId: e.target.value })}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Assign to employee</label>
                <select
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                  value={recurringForm.userId}
                  onChange={(e) => setRecurringForm({ ...recurringForm, userId: e.target.value })}
                >
                  <option value="">Select employee</option>
                  {team.map((member) => (
                    <option key={member._id} value={member._id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Interval days</label>
                  <input
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                    type="number"
                    min="1"
                    placeholder="7"
                    value={recurringForm.intervalDays}
                    onChange={(e) =>
                      setRecurringForm({ ...recurringForm, intervalDays: Number(e.target.value) })
                    }
                  />
                  <span className="text-[11px] text-slate-500">How often to repeat.</span>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Occurrences</label>
                  <input
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
                    type="number"
                    min="1"
                    max="50"
                    placeholder="5"
                    value={recurringForm.occurrences}
                    onChange={(e) =>
                      setRecurringForm({ ...recurringForm, occurrences: Number(e.target.value) })
                    }
                  />
                  <span className="text-[11px] text-slate-500">Total tasks to create.</span>
                </div>
              </div>
              <button
                className="btn-ghost"
                onClick={async () => {
                  await createRecurring(recurringForm);
                  loadOverview();
                  setRecurringForm({ templateId: "", projectId: "", userId: "", intervalDays: 7, occurrences: 5 });
                }}
              >
                Create Recurring
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="gantt" className="card scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Gantt Timeline</h3>
            <p className="text-sm text-slate-400">Each blue bar shows how much time is left between today and that task&apos;s deadline.</p>
          </div>
          <div className="text-xs text-slate-500">
            {deadlineChartTasks.length > 0 && deadlineChartMaxDeadline
              ? `Today ${deadlineChartToday.format("MMM D")} - Latest deadline ${deadlineChartMaxDeadline.format("MMM D, YYYY")}`
              : "No tasks"}
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {deadlineChartTasks.map((task) => {
            const lineWidth = task.remainingRatio > 0 ? Math.max(task.remainingRatio * 100, 3) : 0;

            return (
              <div key={task._id} className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{task.assigneeName} | {task.projectName}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Assigned {task.assignedAt.format("MMM D, YYYY")} | Deadline {task.deadlineAt.format("MMM D, YYYY")} | {task.daysRemaining} days left of {task.totalWindowDays}
                  </div>
                  {task.hasPendingDeadlineEdit ? (
                    <div className="mt-1 text-[11px] text-amber-300">Previewing unsaved deadline change</div>
                  ) : null}
                </div>
                <div className="relative h-6">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-800/70" />
                  {lineWidth > 0 ? (
                    <div
                      className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-brand-500 transition-[width] duration-300 ease-out"
                      style={{ left: "0%", width: `${lineWidth}%` }}
                      title={`${task.title}: ${task.daysRemaining} days left until ${task.deadlineAt.format("MMM D, YYYY")}`}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {deadlineChartTasks.length === 0 ? (
            <div className="text-sm text-slate-500">No tasks for selected project.</div>
          ) : null}
        </div>
        {false ? (
        <div className="mt-4 space-y-4">
          {deadlineChartTasks.map((task) => {
            if (!deadlineChartRange) return null;
            const assignedOffset = Math.max(task.assignedAt.diff(deadlineChartRange.minDate, "day"), 0);
            const deadlineOffset = Math.max(task.deadlineAt.diff(deadlineChartRange.minDate, "day"), 0);
            const assignedLeft = (assignedOffset / deadlineChartRange.totalDays) * 100;
            const deadlineLeft = (deadlineOffset / deadlineChartRange.totalDays) * 100;
            const lineLeft = Math.min(assignedLeft, deadlineLeft);
            const lineWidth = Math.max(Math.abs(deadlineLeft - assignedLeft), 3);

            return (
              <div key={task._id} className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{task.assigneeName}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Deadline {task.deadlineAt.format("MMM D, YYYY")}
                    {task.completedAt?.isValid() ? ` · Completed ${task.completedAt.format("MMM D, YYYY")}` : " · Not completed"}
                  </div>
                </div>
                <div className="relative h-6">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-800/70" />
                  {segmentLeft !== null ? (
                    <div
                      className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${segmentTone}`}
                      style={{ left: `${segmentLeft}%`, width: `${segmentWidth}%` }}
                    />
                  ) : null}
                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200 bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.14)]"
                    style={{ left: `${deadlineLeft}%` }}
                    title={`Deadline: ${task.deadlineAt.format("MMM D, YYYY")}`}
                  />
                  {task.completedAt?.isValid() ? (
                    <div
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-100 bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]"
                      style={{ left: `${completedLeft}%` }}
                      title={`Completed: ${task.completedAt.format("MMM D, YYYY")}`}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {deadlineChartTasks.length === 0 ? (
            <div className="text-sm text-slate-500">No tasks for selected project.</div>
          ) : null}
        </div>
        ) : null}
        {false ? (
        <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
          {roadmapGroups.map((group) => (
            <div
              key={group.key}
              className="min-w-[260px] max-w-[280px] flex-1 rounded-2xl border border-slate-800 bg-slate-950/35 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {group.date.isValid() ? group.date.format("MMM D, YYYY") : "No deadline"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
                  </div>
                </div>
                <div className="rounded-full border border-slate-700 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                  Due
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {group.tasks.map((task) => (
                  <div key={task._id} className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">{task.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{task.assigneeName}</div>
                      </div>
                      <div className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${getTaskStatusToneClass(task.status)}`}>
                        {formatTaskStatusLabel(task.status)}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      <div>Planned start: {task.plannedStart?.isValid() ? task.plannedStart.format("MMM D, YYYY") : "-"}</div>
                      <div>Deadline: {task.plannedEnd?.isValid() ? task.plannedEnd.format("MMM D, YYYY") : "-"}</div>
                      <div>Completed: {task.completedAt?.isValid() ? task.completedAt.format("MMM D, YYYY") : "Not completed"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {roadmapGroups.length === 0 ? (
            <div className="text-sm text-slate-500">No tasks for selected project.</div>
          ) : null}
        </div>
        ) : null}
        {false ? (
          <div className="mt-4 hidden sm:grid sm:grid-cols-[180px_1fr] sm:items-end sm:gap-3">
            <div />
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
              {ganttRange.ticks.map((tick, index) => (
                <span key={`${tick.valueOf()}-${index}`}>{tick.format("MMM D")}</span>
              ))}
            </div>
          </div>
        ) : null}
        {false ? (
        <div className="mt-4 space-y-3">
          {ganttTasks.map((task) => {
            if (!ganttRange) return null;
            const offset = Math.max(task.start.diff(ganttRange.minStart, "day"), 0);
            const duration = Math.max(task.end.diff(task.start, "day"), 1);
            const left = (offset / ganttRange.totalDays) * 100;
            const width = Math.max((duration / ganttRange.totalDays) * 100, 3);
            const completedOffset = task.completedAt
              ? Math.max(task.completedAt.diff(ganttRange.minStart, "day"), 0)
              : null;
            const completedLeft =
              completedOffset === null ? null : (completedOffset / ganttRange.totalDays) * 100;
            return (
              <div key={task._id} className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-3">
                <div>
                  <div className="text-xs text-slate-300">{task.title}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {`${task.start.format("MMM D")} - ${task.end.format("MMM D")}`}
                    {task.status === "done" && task.completedAt ? ` · Completed ${task.completedAt.format("MMM D")}` : ""}
                  </div>
                </div>
                <div className="relative h-3 rounded-full bg-slate-800/80">
                  <div
                    className={`absolute h-3 rounded-full ${task.status === "done" ? "bg-emerald-500" : "bg-brand-500"}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                  {task.status === "done" && completedLeft !== null ? (
                    <div
                      className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-emerald-100"
                      style={{ left: `${completedLeft}%` }}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {ganttTasks.length === 0 && (
            <div className="text-sm text-slate-500">No tasks for selected project.</div>
          )}
        </div>
        ) : null}
      </div>

      <div id="capacity" className="scroll-mt-6">
        <AvailabilityCard />
      </div>


      <Modal open={open} title="Assign Task" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={handleAssign}>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">
            Employees in any role must add a same-day progress update before they can stop or complete a task. Ask them
            to record the work type, the exact area touched, the progress state, and supporting evidence for that day.
          </div>
          <select
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>{project.name}</option>
            ))}
          </select>
          <select
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
          >
            <option value="">Select team member</option>
            {team.map((member) => (
              <option key={member._id} value={member._id}>{member.name}</option>
            ))}
          </select>
          <input
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            placeholder="Task details"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <select
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            value={form.roleContribution}
            onChange={(e) => setForm({ ...form, roleContribution: e.target.value })}
          >
            <option value="">Select role contribution</option>
            <option value="Designer">Designer</option>
            <option value="Frontend Developer">Frontend Developer</option>
            <option value="Backend Developer">Backend Developer</option>
            <option value="Tester">Tester</option>
          </select>
          <input
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <button className="btn-primary" type="submit">Assign Task</button>
        </form>
      </Modal>
      <Modal
        open={Boolean(proofHistoryTask)}
        title={proofHistoryTask ? `Proof History: ${proofHistoryTask.title}` : "Proof History"}
        onClose={() => {
          setProofHistoryTask(null);
          setProofHistoryLoading(false);
        }}
      >
        {proofHistoryLoading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            Loading proof history...
          </div>
        ) : (
          <TaskProofHistory
            task={proofHistoryTask}
            onRecheckLog={(log) => handleRecheckProof(proofHistoryTask?._id, log?.entryId)}
            recheckingEntryId={recheckingEntryId}
          />
        )}
      </Modal>
    </div>
  );
};

export default ManagerDashboard;
