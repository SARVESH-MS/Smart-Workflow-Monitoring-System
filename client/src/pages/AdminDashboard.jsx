import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { listProjects, createProject, updateProject, deleteProject } from "../api/projects.js";
import { summary } from "../api/analytics.js";
import { listTasks, deleteTask } from "../api/tasks.js";
import StatCard from "../components/StatCard.jsx";
import Table from "../components/Table.jsx";
import Modal from "../components/Modal.jsx";
import { formatDate } from "../utils/date.js";
import { createSocket } from "../utils/socket.js";
import {
  listUsers,
  updateUserPreferences,
  listRegistrationRequests,
  processRegistrationRequest,
  listLoginActivity,
  listSessionMonitor
} from "../api/users.js";
import { listTemplates, updateTemplate } from "../api/templates.js";
import { listEmailLogs } from "../api/emails.js";
import GlobalSearch from "../components/GlobalSearch.jsx";
import DigestSender from "../components/DigestSender.jsx";

const CompletionChart = lazy(() => import("../charts/CompletionChart.jsx"));
const DelayChart = lazy(() => import("../charts/DelayChart.jsx"));

const DisclosureIcon = ({ open }) => (
  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center" aria-hidden="true">
    <svg
      viewBox="0 0 64 64"
      className={`h-6 w-6 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
    >
      <rect x="9" y="9" width="46" height="46" rx="12" fill="#11181d" stroke="#11181d" strokeWidth="1.5" />
      <rect x="6" y="6" width="52" height="52" rx="15" stroke="#f8fafc" strokeWidth="2.4" />
      <rect x="8.5" y="8.5" width="47" height="47" rx="13" stroke="#0f172a" strokeWidth="1.4" opacity="0.75" />
      <path d="M32 40 19 26h26L32 40Z" fill="#f8fafc" />
    </svg>
  </span>
);

const AdminDashboard = () => {
  const defaultWorkflow = ["Planning", "Design", "Development", "Testing", "Done"];
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [chartTaskLists, setChartTaskLists] = useState(null);
  const chartTaskPromiseRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [loginActivity, setLoginActivity] = useState([]);
  const [sessionMonitor, setSessionMonitor] = useState([]);
  const [requestManagerMap, setRequestManagerMap] = useState({});
  const [templates, setTemplates] = useState({});
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [loginActivityOpen, setLoginActivityOpen] = useState(false);
  const [sessionMonitorOpen, setSessionMonitorOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [draggedStage, setDraggedStage] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const statsRefreshTimerRef = useRef(null);
  const preferenceSaveTimersRef = useRef({});
  const savedPreferenceSnapshotsRef = useRef({});
  const preferenceRequestVersionRef = useRef({});
  const [form, setForm] = useState({
    name: "",
    description: "",
    deadline: "",
    managerId: "",
    workflow: defaultWorkflow
  });

  const moveWorkflowStage = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setForm((current) => {
      const nextWorkflow = [...current.workflow];
      const [movedStage] = nextWorkflow.splice(fromIndex, 1);
      nextWorkflow.splice(toIndex, 0, movedStage);
      return { ...current, workflow: nextWorkflow };
    });
  };

  const handleWorkflowDrop = (targetStage) => {
    if (!draggedStage || draggedStage === targetStage) return;
    const fromIndex = form.workflow.indexOf(draggedStage);
    const toIndex = form.workflow.indexOf(targetStage);
    moveWorkflowStage(fromIndex, toIndex);
    setDraggedStage("");
  };

  const formatRoleLabel = (value) =>
    String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());

  const normalizeNotificationPrefs = (prefs = {}) => ({
    emailDelay: Boolean(prefs?.emailDelay),
    emailComplete: Boolean(prefs?.emailComplete),
    smsDelay: Boolean(prefs?.smsDelay),
    smsComplete: Boolean(prefs?.smsComplete),
    smsDailyProgress: Boolean(prefs?.smsDailyProgress),
    desktopDailyProgress:
      prefs?.desktopDailyProgress === undefined ? true : Boolean(prefs?.desktopDailyProgress)
  });

  const buildNotificationPrefs = (user, key, value) => ({
    ...normalizeNotificationPrefs(user.notificationPrefs),
    [key]: value
  });

  const syncSavedPreferenceSnapshots = (userList) => {
    savedPreferenceSnapshotsRef.current = Object.fromEntries(
      (userList || []).map((user) => [user._id, normalizeNotificationPrefs(user.notificationPrefs)])
    );
  };

  const mergeUserIntoLists = (user) => {
    const normalizedUser = { ...user, _id: user.id || user._id };
    if (!normalizedUser._id) return;
    setUsers((prev) => {
      const exists = prev.some((item) => String(item._id) === String(normalizedUser._id));
      const next = exists
        ? prev.map((item) => (String(item._id) === String(normalizedUser._id) ? { ...item, ...normalizedUser } : item))
        : [normalizedUser, ...prev];
      syncSavedPreferenceSnapshots(next);
      return next;
    });
    setManagers((prev) => {
      const exists = prev.some((item) => String(item._id) === String(normalizedUser._id));
      if (normalizedUser.role !== "manager") {
        return exists ? prev.filter((item) => String(item._id) !== String(normalizedUser._id)) : prev;
      }
      if (!exists) return [normalizedUser, ...prev];
      return prev.map((item) => (String(item._id) === String(normalizedUser._id) ? { ...item, ...normalizedUser } : item));
    });
  };

  const handleNotificationPreferenceChange = (user, key, value) => {
    const userId = user._id;
    const nextPrefs = buildNotificationPrefs(user, key, value);

    setUsers((prev) =>
      prev.map((item) =>
        item._id === userId ? { ...item, notificationPrefs: nextPrefs } : item
      )
    );

    window.clearTimeout(preferenceSaveTimersRef.current[userId]);
    const requestVersion = (preferenceRequestVersionRef.current[userId] || 0) + 1;
    preferenceRequestVersionRef.current[userId] = requestVersion;

    preferenceSaveTimersRef.current[userId] = window.setTimeout(async () => {
      try {
        const response = await updateUserPreferences(userId, nextPrefs);
        if (preferenceRequestVersionRef.current[userId] !== requestVersion) return;
        const savedPrefs = normalizeNotificationPrefs(response?.user?.notificationPrefs || nextPrefs);
        savedPreferenceSnapshotsRef.current[userId] = savedPrefs;
        setUsers((prev) =>
          prev.map((item) =>
            item._id === userId ? { ...item, notificationPrefs: savedPrefs } : item
          )
        );
      } catch (error) {
        if (preferenceRequestVersionRef.current[userId] !== requestVersion) return;
        const fallbackPrefs = savedPreferenceSnapshotsRef.current[userId] || normalizeNotificationPrefs();
        setUsers((prev) =>
          prev.map((item) =>
            item._id === userId ? { ...item, notificationPrefs: fallbackPrefs } : item
          )
        );
      }
    }, 140);
  };

  const loadOverview = async () => {
    const [projectsData, statsData, tasksData] = await Promise.all([
      listProjects(),
      summary(),
      listTasks({ compact: 1, limit: 2000 })
    ]);
    setProjects(projectsData);
    setStats(statsData);
    setTasks(tasksData || []);
    // Invalidate cached task lists so graphs can re-fetch when needed.
    setChartTaskLists(null);
  };

  const refreshStatsOnly = async () => {
    const statsData = await summary();
    setStats(statsData);
  };

  const queueStatsRefresh = () => {
    window.clearTimeout(statsRefreshTimerRef.current);
    statsRefreshTimerRef.current = window.setTimeout(() => {
      refreshStatsOnly();
    }, 180);
  };

  const getProjectNameForTask = (task, projectList = projects) =>
    projectList.find((project) => String(project._id) === String(task?.projectId))?.name || task?.projectName || "";

  const applyTaskToChartLists = (task) => {
    setChartTaskLists((prev) => {
      if (!prev || !task?._id) return prev;
      const nextTask = {
        ...task,
        projectName: getProjectNameForTask(task)
      };
      const withoutTask = {
        completedTasks: prev.completedTasks.filter((item) => String(item._id) !== String(task._id)),
        remainingTasks: prev.remainingTasks.filter((item) => String(item._id) !== String(task._id)),
        delayedTasks: prev.delayedTasks.filter((item) => String(item._id) !== String(task._id)),
        onTimeTasks: prev.onTimeTasks.filter((item) => String(item._id) !== String(task._id))
      };
      return {
        completedTasks: nextTask.status === "done" ? [nextTask, ...withoutTask.completedTasks] : withoutTask.completedTasks,
        remainingTasks: nextTask.status !== "done" ? [nextTask, ...withoutTask.remainingTasks] : withoutTask.remainingTasks,
        delayedTasks: nextTask.isDelayed ? [nextTask, ...withoutTask.delayedTasks] : withoutTask.delayedTasks,
        onTimeTasks: !nextTask.isDelayed ? [nextTask, ...withoutTask.onTimeTasks] : withoutTask.onTimeTasks
      };
    });
  };

  const removeTaskFromChartLists = (task) => {
    const taskId = String(task?._id || "");
    if (!taskId) return;
    setChartTaskLists((prev) => {
      if (!prev) return prev;
      return {
        completedTasks: prev.completedTasks.filter((item) => String(item._id) !== taskId),
        remainingTasks: prev.remainingTasks.filter((item) => String(item._id) !== taskId),
        delayedTasks: prev.delayedTasks.filter((item) => String(item._id) !== taskId),
        onTimeTasks: prev.onTimeTasks.filter((item) => String(item._id) !== taskId)
      };
    });
  };

  const applyProjectToChartLists = (project) => {
    setChartTaskLists((prev) => {
      if (!prev || !project?._id) return prev;
      const applyProjectName = (task) =>
        String(task.projectId) === String(project._id)
          ? { ...task, projectName: project.name }
          : task;

      return {
        completedTasks: prev.completedTasks.map(applyProjectName),
        remainingTasks: prev.remainingTasks.map(applyProjectName),
        delayedTasks: prev.delayedTasks.map(applyProjectName),
        onTimeTasks: prev.onTimeTasks.map(applyProjectName)
      };
    });
  };

  const loadUsersAndRequests = async () => {
    const [usersResult, managersResult, requestsResult] = await Promise.allSettled([
      listUsers(),
      listUsers("manager"),
      listRegistrationRequests("pending")
    ]);

    if (usersResult.status === "fulfilled") {
      setUsers(usersResult.value);
      syncSavedPreferenceSnapshots(usersResult.value);
    } else {
      console.error("Failed to load users", usersResult.reason);
    }

    if (managersResult.status === "fulfilled") {
      setManagers(managersResult.value);
    } else {
      console.error("Failed to load managers", managersResult.reason);
    }

    if (requestsResult.status === "fulfilled") {
      setRegistrationRequests(requestsResult.value);
    } else {
      console.error("Failed to load registration requests", requestsResult.reason);
    }
  };

  const loadTemplates = async () => {
    const templateData = await listTemplates();
    const map = {};
    templateData.forEach((t) => {
      map[t.key] = t;
    });
    setTemplates(map);
  };

  const loadLoginActivity = async () => {
    const activityData = await listLoginActivity(300);
    setLoginActivity(activityData);
  };

  const loadSessionData = async () => {
    const sessionData = await listSessionMonitor();
    setSessionMonitor(sessionData);
  };

  useEffect(() => {
    loadOverview();
    loadUsersAndRequests();
  }, []);
  useEffect(() => {
    const socket = createSocket();
    socket.on("task:created", (task) => {
      applyTaskToChartLists(task);
      setTasks((prev) =>
        prev.some((item) => String(item._id) === String(task?._id))
          ? prev
          : [task, ...prev]
      );
      queueStatsRefresh();
    });
    socket.on("task:updated", (task) => {
      applyTaskToChartLists(task);
      setTasks((prev) => {
        const exists = prev.some((item) => String(item._id) === String(task?._id));
        if (!exists) return [task, ...prev];
        return prev.map((item) => (String(item._id) === String(task?._id) ? { ...item, ...task } : item));
      });
      queueStatsRefresh();
    });
    socket.on("task:deleted", (task) => {
      setTasks((prev) => prev.filter((item) => String(item._id) !== String(task?._id)));
      removeTaskFromChartLists(task);
      queueStatsRefresh();
    });
    socket.on("project:created", (project) => {
      setProjects((prev) =>
        prev.some((item) => String(item._id) === String(project?._id))
          ? prev
          : [project, ...prev]
      );
      applyProjectToChartLists(project);
      queueStatsRefresh();
    });
    socket.on("project:updated", (project) => {
      setProjects((prev) =>
        prev.some((item) => String(item._id) === String(project?._id))
          ? prev.map((item) => (String(item._id) === String(project?._id) ? { ...item, ...project } : item))
          : [project, ...prev]
      );
      applyProjectToChartLists(project);
      queueStatsRefresh();
    });
    socket.on("project:deleted", (payload) => {
      const projectId = String(payload?.id || payload?._id || "");
      if (!projectId) return;
      setProjects((prev) => prev.filter((item) => String(item._id) !== projectId));
      setTasks((prev) => prev.filter((task) => String(task.projectId) !== projectId));
      setChartTaskLists(null);
      queueStatsRefresh();
    });
    socket.on("user:created", (user) => {
      mergeUserIntoLists(user);
    });
    socket.on("user:updated", (user) => {
      mergeUserIntoLists(user);
    });
    socket.on("registration-request:created", (request) => {
      if (String(request?.status || "pending") !== "pending") return;
      setRegistrationRequests((prev) =>
        prev.some((item) => String(item._id) === String(request?._id))
          ? prev
          : [request, ...prev]
      );
    });
    socket.on("registration-request:updated", (request) => {
      const requestId = String(request?._id || "");
      if (!requestId) return;
      setRegistrationRequests((prev) => {
        const exists = prev.some((item) => String(item._id) === requestId);
        if (String(request?.status || "") !== "pending") {
          return exists ? prev.filter((item) => String(item._id) !== requestId) : prev;
        }
        if (!exists) return [request, ...prev];
        return prev.map((item) => (String(item._id) === requestId ? { ...item, ...request } : item));
      });
    });
    socket.on("presence:update", () => {
      if (sessionMonitorOpen) {
        loadSessionData();
      }
    });
    return () => {
      window.clearTimeout(statsRefreshTimerRef.current);
      Object.values(preferenceSaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      socket.disconnect();
    };
  }, [sessionMonitorOpen]);

  useEffect(() => {
    if (!sessionMonitorOpen) return undefined;
    loadSessionData();
    const timer = setInterval(loadSessionData, 20000);
    return () => clearInterval(timer);
  }, [sessionMonitorOpen]);

  useEffect(() => {
    if (!loginActivityOpen) return;
    loadLoginActivity();
  }, [loginActivityOpen]);

  useEffect(() => {
    if (!emailsOpen) return;
    listEmailLogs().then(setEmailLogs);
  }, [emailsOpen]);

  useEffect(() => {
    if (!templatesOpen) return;
    loadTemplates();
  }, [templatesOpen]);

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!taskId || deletingTaskId) return;
    const confirmed = window.confirm(`Delete "${taskTitle || "this task"}"? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingTaskId(taskId);
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => String(task._id) !== String(taskId)));
      removeTaskFromChartLists({ _id: taskId });
      queueStatsRefresh();
    } finally {
      setDeletingTaskId("");
    }
  };

  const handleDeleteProject = async (projectId, projectName) => {
    if (!projectId || deletingProjectId) return;
    const confirmed = window.confirm(`Delete "${projectName || "this project"}"? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingProjectId(projectId);
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((project) => String(project._id) !== String(projectId)));
      setTasks((prev) => prev.filter((task) => String(task.projectId) !== String(projectId)));
      setChartTaskLists(null);
      queueStatsRefresh();
    } finally {
      setDeletingProjectId("");
    }
  };

  const columns = useMemo(
    () => [
      { key: "name", label: "Project" },
      { key: "description", label: "Description" },
      { key: "deadline", label: "Deadline" },
      { key: "manager", label: "Manager" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Actions" }
    ],
    []
  );

  const taskColumns = useMemo(
    () => [
      { key: "title", label: "Task" },
      { key: "project", label: "Project" },
      { key: "assignee", label: "Assignee" },
      { key: "status", label: "Status" },
      { key: "deadline", label: "Deadline" },
      { key: "actions", label: "Actions" }
    ],
    []
  );

  const rows = projects.map((project) => {
    const isDeleting = deletingProjectId === project._id;
    const isDone = String(project.status || "").toLowerCase() === "done";
    const statusLabel = isDone ? "Done" : "In Progress";
    return {
      ...project,
      deadline: formatDate(project.deadline),
      manager: (
        <select
          className="rounded-lg bg-slate-900 px-2 py-1 text-xs"
          value={project.managerId || ""}
          onChange={async (e) => {
            const managerId = e.target.value || null;
            const updated = await updateProject(project._id, { managerId });
            setProjects((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
          }}
        >
          <option value="">Unassigned</option>
          {managers.map((mgr) => (
            <option key={mgr._id} value={mgr._id}>
              {mgr.name}
            </option>
          ))}
        </select>
      ),
      actions: (
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs border-rose-400/70 text-rose-300 hover:border-rose-300 hover:bg-rose-950/40 hover:text-rose-100"
          onClick={() => handleDeleteProject(project._id, project.name)}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      ),
      status: (
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap ${
            isDone
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-sky-500/30 bg-sky-500/10 text-sky-200"
          }`}
        >
          {statusLabel}
        </span>
      )
    };
  });
  const projectNameById = useMemo(
    () =>
      projects.reduce((acc, project) => {
        acc[String(project._id)] = project.name;
        return acc;
      }, {}),
    [projects]
  );
  const userNameById = useMemo(
    () =>
      users.reduce((acc, user) => {
        acc[String(user._id)] = user.name;
        return acc;
      }, {}),
    [users]
  );
  const formatTaskStatusLabel = (status) =>
    String(status || "todo")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const taskRows = tasks.map((task) => {
    const isDeleting = deletingTaskId === task._id;
    return {
      ...task,
      title: (
        <div className="min-w-[12rem]">
          <div className="font-medium text-slate-100">{task.title}</div>
          {task.description ? (
            <div className="mt-1 text-xs text-slate-400">{task.description}</div>
          ) : null}
        </div>
      ),
      project: projectNameById[String(task.projectId)] || "-",
      assignee: userNameById[String(task.userId)] || "-",
      status: (
        <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
          {formatTaskStatusLabel(task.status)}
        </span>
      ),
      deadline: formatDate(task.deadline),
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
  const onlineSessions = sessionMonitor.filter((item) => item.isOnline);

  const ensureChartTaskLists = async () => {
    if (chartTaskLists) return chartTaskLists;
    if (chartTaskPromiseRef.current) return chartTaskPromiseRef.current;

    chartTaskPromiseRef.current = (async () => {
      const [projectsData, tasksData] = await Promise.all([
        projects.length ? Promise.resolve(projects) : listProjects(),
        listTasks({ compact: 1, limit: 2000 })
      ]);

      const projectNameById = projectsData.reduce((acc, p) => {
        acc[String(p._id)] = p.name;
        return acc;
      }, {});

      const enrichedTasks = (tasksData || []).map((t) => ({
        ...t,
        projectName: projectNameById[String(t.projectId)] || ""
      }));

      const lists = {
        completedTasks: enrichedTasks.filter((t) => t.status === "done"),
        remainingTasks: enrichedTasks.filter((t) => t.status !== "done"),
        delayedTasks: enrichedTasks.filter((t) => t.isDelayed),
        onTimeTasks: enrichedTasks.filter((t) => !t.isDelayed)
      };

      setChartTaskLists(lists);
      return lists;
    })();

    try {
      return await chartTaskPromiseRef.current;
    } finally {
      chartTaskPromiseRef.current = null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const createdProject = await createProject(form);
    setProjects((prev) => [createdProject, ...prev]);
    applyProjectToChartLists(createdProject);
    queueStatsRefresh();
    setOpen(false);
    setForm({
      name: "",
      description: "",
      deadline: "",
      managerId: "",
      workflow: defaultWorkflow
    });
  };


  return (
    <div className="dashboard-page grid min-w-0 gap-6">
      <div id="overview" className="flex flex-wrap items-center justify-between gap-4 scroll-mt-6">
        <div>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-slate-400">Portfolio view across all teams</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => setEmailsOpen(true)}>Emails</button>
          <button className="btn-primary" onClick={() => setOpen(true)}>Add Project</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projects" value={stats?.projects ?? "-"} />
        <StatCard label="Total Tasks" value={stats?.totalTasks ?? "-"} />
        <StatCard label="Delays" value={stats?.delayed ?? "-"} />
        <StatCard label="Completion" value={`${stats?.completionRate ?? "-"}%`} />
      </div>

      <GlobalSearch />

      <div id="tasks" className="scroll-mt-6">
        <div className="grid gap-4">
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-100">Tasks</div>
            <Table columns={taskColumns} data={taskRows} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-100">Projects</div>
            <Table columns={columns} data={rows} />
          </div>
        </div>
      </div>

      <div id="reports" className="grid gap-4 lg:grid-cols-2 scroll-mt-6">
        <div className="card">
          <h3 className="text-lg font-semibold">Workflow Builder</h3>
          <p className="text-sm text-slate-400">Drag and reorder stages</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {form.workflow.map((stage, index) => (
              <div
                key={stage}
                draggable
                onDragStart={() => setDraggedStage(stage)}
                onDragEnd={() => setDraggedStage("")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleWorkflowDrop(stage)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                  draggedStage === stage
                    ? "border-blue-400 bg-blue-500/10 text-blue-200"
                    : "border-slate-700"
                }`}
              >
                <button
                  type="button"
                  className="text-slate-400 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => moveWorkflowStage(index, index - 1)}
                  aria-label={`Move ${stage} left`}
                >
                  ←
                </button>
                <span>{stage}</span>
                <button
                  type="button"
                  className="text-slate-400 disabled:opacity-30"
                  disabled={index === form.workflow.length - 1}
                  onClick={() => moveWorkflowStage(index, index + 1)}
                  aria-label={`Move ${stage} right`}
                >
                  →
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Reordered stages will be used for new projects created from this admin session.
          </p>
        </div>
        <Suspense fallback={<div className="card text-sm text-slate-400">Loading completion chart...</div>}>
          <CompletionChart
            completed={stats?.completed ?? 0}
            total={stats?.totalTasks ?? 0}
            completedTasks={chartTaskLists?.completedTasks || null}
            remainingTasks={chartTaskLists?.remainingTasks || null}
            loadTaskLists={async () => {
              const lists = await ensureChartTaskLists();
              return { completedTasks: lists.completedTasks, remainingTasks: lists.remainingTasks };
            }}
          />
        </Suspense>
      </div>

      <div id="alerts" className="grid gap-4 lg:grid-cols-2 scroll-mt-6">
        <Suspense fallback={<div className="card text-sm text-slate-400">Loading delay chart...</div>}>
          <DelayChart
            delayed={stats?.delayed ?? 0}
            onTime={(stats?.totalTasks ?? 0) - (stats?.delayed ?? 0)}
            delayedTasks={chartTaskLists?.delayedTasks || null}
            onTimeTasks={chartTaskLists?.onTimeTasks || null}
            loadTaskLists={async () => {
              const lists = await ensureChartTaskLists();
              return { delayedTasks: lists.delayedTasks, onTimeTasks: lists.onTimeTasks };
            }}
          />
        </Suspense>
        <div className="card">
          <h3 className="text-lg font-semibold">Analytics Snapshot</h3>
          <p className="text-sm text-slate-400">Live completion and delay rates.</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            <div>Time Spent: {stats?.timeSpent ?? 0} mins</div>
            <div>Completion Rate: {stats?.completionRate ?? 0}%</div>
            <div>Delayed Tasks: {stats?.delayed ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold">User Notification Overrides</h3>
        <p className="text-sm text-slate-400">Admin can update team preferences.</p>
        <div
          className="table-scroll mt-4 w-full max-w-full overflow-x-auto overflow-y-hidden thin-scrollbar pb-2"
          style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
        >
          <table className="min-w-[920px] w-full text-left text-xs sm:text-sm">
            <thead className="text-[11px] uppercase text-slate-400 sm:text-xs">
              <tr>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Email Delay</th>
                <th className="py-2 pr-4">Email Complete</th>
                <th className="py-2 pr-4">Laptop Popup</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-t border-slate-800 transition-colors hover:bg-slate-900/30">
                  <td className="py-2 pr-4">
                    <div className="text-slate-200">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="py-2 pr-4 text-slate-300">{formatRoleLabel(user.role)}</td>
                  {[
                    { key: "emailDelay", label: "Email Delay" },
                    { key: "emailComplete", label: "Email Complete" },
                    { key: "desktopDailyProgress", label: "Desktop Popup" }
                  ].map((pref) => (
                    <td key={pref.key} className="py-2 pr-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-500"
                        checked={Boolean(user.notificationPrefs?.[pref.key])}
                        title={`${pref.label} for ${user.name}`}
                        aria-label={`${pref.label} for ${user.name}`}
                        onChange={(e) => handleNotificationPreferenceChange(user, pref.key, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="digest" className="scroll-mt-6">
        <DigestSender />
      </div>

      <div id="authorization" className="card scroll-mt-6">
        <h3 className="text-lg font-semibold">New User Authorization</h3>
        <p className="text-sm text-slate-400">Approve or reject pending registration requests.</p>
        <div
          className="table-scroll mt-4 w-full max-w-full overflow-x-auto overflow-y-hidden thin-scrollbar pb-2"
          style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
        >
          <table className="min-w-[640px] w-full text-left text-xs sm:text-sm">
            <thead className="text-[11px] uppercase text-slate-400 sm:text-xs">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Team Role</th>
                <th className="py-2 pr-4">Assign Manager</th>
                <th className="py-2 pr-4">Requested</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {registrationRequests.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-400" colSpan={7}>No pending requests.</td>
                </tr>
              )}
              {registrationRequests.map((req) => (
                <tr key={req._id} className="border-t border-slate-800">
                  <td className="py-2 pr-4 text-slate-200">{req.name}</td>
                  <td className="py-2 pr-4 text-slate-300">{req.email}</td>
                  <td className="py-2 pr-4 text-slate-300">{req.role}</td>
                  <td className="py-2 pr-4 text-slate-300">{req.teamRole}</td>
                  <td className="py-2 pr-4">
                    {req.role === "employee" ? (
                      <select
                        className="rounded-lg bg-slate-900 px-2 py-1 text-xs"
                        value={requestManagerMap[req._id] || ""}
                        onChange={(e) =>
                          setRequestManagerMap((prev) => ({ ...prev, [req._id]: e.target.value }))
                        }
                      >
                        <option value="">Select manager</option>
                        {managers.map((mgr) => (
                          <option key={mgr._id} value={mgr._id}>
                            {mgr.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-500">N/A</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{new Date(req.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost px-3 py-1 text-xs disabled:opacity-50"
                        disabled={req.role === "employee" && !requestManagerMap[req._id]}
                        onClick={async () => {
                          await processRegistrationRequest(req._id, {
                            action: "approve",
                            managerId: requestManagerMap[req._id]
                          });
                          setRegistrationRequests((prev) => prev.filter((x) => x._id !== req._id));
                          loadUsersAndRequests();
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-ghost px-3 py-1 text-xs"
                        onClick={async () => {
                          const reason = prompt("Reason for rejection (optional):") || "";
                          await processRegistrationRequest(req._id, { action: "reject", reason });
                          setRegistrationRequests((prev) => prev.filter((x) => x._id !== req._id));
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="session-monitor" className="card scroll-mt-6">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setSessionMonitorOpen((prev) => !prev)}
        >
          <div>
            <h3 className="text-lg font-semibold">Session Monitor</h3>
            <p className="text-sm text-slate-400">Track who is online, login time, and last seen.</p>
          </div>
          <DisclosureIcon open={sessionMonitorOpen} />
        </button>
        {sessionMonitorOpen && (
          <div
            className="table-scroll mt-4 max-h-80 w-full max-w-full overflow-x-auto overflow-y-auto thin-scrollbar pb-2"
            style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <table className="min-w-[640px] w-full text-left text-xs sm:text-sm">
              <thead className="text-[11px] uppercase text-slate-400 sm:text-xs">
                <tr>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Logged In</th>
                  <th className="py-2 pr-4">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {onlineSessions.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-400" colSpan={5}>No users are online right now.</td>
                  </tr>
                )}
                {onlineSessions.map((item) => (
                  <tr key={item.userId} className="border-t border-slate-800">
                    <td className="py-2 pr-4">
                      <div className="text-slate-200">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.email}</div>
                    </td>
                    <td className="py-2 pr-4 text-slate-300 uppercase">{item.role}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          item.isOnline
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {item.isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {item.loggedInAt ? new Date(item.loggedInAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div id="login-activity" className="card scroll-mt-6">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setLoginActivityOpen((prev) => !prev)}
        >
          <div>
            <h3 className="text-lg font-semibold">Manager & Employee Login Activity</h3>
            <p className="text-sm text-slate-400">Tracks login/logout time with role and device details.</p>
          </div>
          <DisclosureIcon open={loginActivityOpen} />
        </button>
        {loginActivityOpen && (
          <div
            className="table-scroll mt-4 max-h-80 w-full max-w-full overflow-x-auto overflow-y-auto thin-scrollbar pb-2"
            style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <table className="min-w-[720px] w-full text-left text-xs sm:text-sm">
              <thead className="text-[11px] uppercase text-slate-400 sm:text-xs">
                <tr>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">Device</th>
                </tr>
              </thead>
              <tbody>
                {loginActivity.length === 0 && (
                  <tr>
                    <td className="py-3 text-slate-400" colSpan={6}>No login activity yet.</td>
                  </tr>
                )}
                {loginActivity.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="py-2 pr-4">
                      <div className="text-slate-200">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.email}</div>
                    </td>
                    <td className="py-2 pr-4 text-slate-300 uppercase">{item.role}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          item.action === "login"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-300">{new Date(item.at).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-slate-400">{item.ip}</td>
                    <td className="max-w-[360px] truncate py-2 pr-4 text-xs text-slate-500" title={item.userAgent}>
                      {item.deviceName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div id="templates" className="card scroll-mt-6">
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setTemplatesOpen((prev) => !prev)}
        >
          <div>
            <h3 className="text-lg font-semibold">Notification Templates</h3>
            <p className="text-sm text-slate-400">Edit email/Slack templates.</p>
          </div>
          <DisclosureIcon open={templatesOpen} />
        </button>
        {templatesOpen && (
          <div className="mt-4 grid gap-4">
          {[
            { key: "task.delay.email", label: "Task Delay Email" },
            { key: "task.complete.email", label: "Task Complete Email" },
            { key: "task.assigned.email", label: "Task Assigned Email" },
            { key: "task.delay.slack", label: "Task Delay Slack" },
            { key: "task.complete.slack", label: "Task Complete Slack" },
            { key: "task.assigned.slack", label: "Task Assigned Slack" }
          ].map((tpl) => (
              <div key={tpl.key} className="rounded-xl border border-slate-800 p-4">
                <div className="text-sm font-semibold">{tpl.label}</div>
                <input
                  className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm"
                  placeholder="Subject"
                  value={templates[tpl.key]?.subject || ""}
                  onChange={(e) =>
                    setTemplates((prev) => ({
                      ...prev,
                      [tpl.key]: { ...(prev[tpl.key] || {}), subject: e.target.value }
                    }))
                  }
                />
                <textarea
                  className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm"
                  rows={4}
                  placeholder="Body (HTML allowed). Use {{task.title}}, {{project.name}}, {{user.name}}, {{task.deadline}}"
                  value={templates[tpl.key]?.body || ""}
                  onChange={(e) =>
                    setTemplates((prev) => ({
                      ...prev,
                      [tpl.key]: { ...(prev[tpl.key] || {}), body: e.target.value }
                    }))
                  }
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="btn-ghost"
                  onClick={async () => {
                      const payload = {
                        subject: templates[tpl.key]?.subject || "",
                        body: templates[tpl.key]?.body || ""
                      };
                      const saved = await updateTemplate(tpl.key, payload);
                      setTemplates((prev) => ({ ...prev, [tpl.key]: saved }));
                    }}
                  >
                    Save Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} title="Add New Project" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            placeholder="Project name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <select
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            value={form.managerId}
            onChange={(e) => setForm({ ...form, managerId: e.target.value })}
          >
            <option value="">Select manager</option>
            {managers.map((mgr) => (
              <option key={mgr._id} value={mgr._id}>
                {mgr.name} ({mgr.email})
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">Create Project</button>
        </form>
      </Modal>

      <Modal open={emailsOpen} title="Sent Emails" onClose={() => setEmailsOpen(false)}>
        <div className="grid max-h-[70vh] gap-3 overflow-auto pr-1 text-sm">
          {emailLogs.length === 0 && <div className="text-slate-400">No emails logged yet.</div>}
          {emailLogs.map((log) => (
            <div key={log._id} className="rounded-xl border border-slate-800 p-3">
              <div className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
              <div className="mt-1 text-slate-200"><strong>To:</strong> {log.to}</div>
              <div className="text-slate-200"><strong>Subject:</strong> {log.subject || "-"}</div>
              <div className="mt-2 text-xs text-slate-400">Template: {log.templateKey || "-"}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
