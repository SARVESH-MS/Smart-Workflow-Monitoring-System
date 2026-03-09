import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listProjects } from "../api/projects.js";
import { listTasks, createTask, updateTask } from "../api/tasks.js";
import api from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import Table from "../components/Table.jsx";
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
  const [savedFilters, setSavedFilters] = useState(() => {
    const raw = localStorage.getItem("swms_manager_filters");
    return raw ? JSON.parse(raw) : [];
  });
  const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
  const [deadlineEdits, setDeadlineEdits] = useState({});
  const [open, setOpen] = useState(false);
  const [unreadEmails, setUnreadEmails] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadForum, setUnreadForum] = useState(0);
  const [forumSender, setForumSender] = useState("");
  const [form, setForm] = useState({
    projectId: "",
    userId: "",
    title: "",
    description: "",
    roleContribution: "",
    deadline: ""
  });

  const load = async () => {
    const [teamData, projectsData, tasksData, templateData] = await Promise.all([
      api.get(`/api/users/team/${id}`).then((res) => res.data),
      listProjects(),
      listTasks(),
      listTaskTemplates()
    ]);
    setTeam(teamData);
    setProjects(projectsData);
    setTasks(tasksData);
    setTemplates(templateData);
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
    load();
  }, [id]);
  useEffect(() => {
    loadBadges();
    const timer = setInterval(loadBadges, 15000);
    return () => clearInterval(timer);
  }, [id]);
  useEffect(() => {
    const socket = createSocket();
    socket.on("task:created", () => {
      load();
      loadBadges();
    });
    socket.on("task:updated", () => {
      load();
      loadBadges();
    });
    socket.on("project:updated", load);
    return () => socket.disconnect();
  }, [id]);

  const taskColumns = useMemo(
    () => [
      { key: "select", label: "" },
      { key: "title", label: "Task" },
      { key: "assignee", label: "Assignee" },
      { key: "deadline", label: "Deadline" },
      { key: "timeSpent", label: "Time Spent" },
      { key: "status", label: "Status" }
    ],
    []
  );

  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const filteredTasks = tasks.filter((task) => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.stage && (task.stage || "Planning") !== filters.stage) return false;
    return true;
  });

  const taskRows = filteredTasks.map((task) => {
    const user = team.find((member) => member._id === task.userId);
    const editValue = deadlineEdits[task._id] ?? (task.deadline ? dayjs(task.deadline).format("YYYY-MM-DD") : "");
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
      assignee: user?.name || "-",
      timeSpent: formatDurationHours(task.timeSpent || 0),
      deadline: (
        <div className="flex items-center gap-2">
          <input
            className="rounded-lg bg-slate-900 px-2 py-1 text-xs"
            type="date"
            value={editValue}
            onChange={(e) =>
              setDeadlineEdits((prev) => ({ ...prev, [task._id]: e.target.value }))
            }
          />
          <button
            className="btn-ghost px-2 py-1 text-xs"
            onClick={async () => {
              if (!editValue) return;
              await updateTask(task._id, { deadline: editValue });
              setDeadlineEdits((prev) => {
                const next = { ...prev };
                delete next[task._id];
                return next;
              });
              load();
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
      )
    };
  });

  const selectedProject = projects.find((p) => p._id === selectedProjectId);
  const kanbanStages = selectedProject?.workflow || [
    "Planning",
    "Design",
    "Development",
    "Testing",
    "Done"
  ];
  const projectTasks = tasks.filter((t) => t.projectId === selectedProjectId);

  const handleDrop = async (taskId, stage) => {
    await updateTask(taskId, { stage });
    load();
  };

  const ganttTasks = projectTasks.map((task) => {
    const start = task.startTime ? dayjs(task.startTime) : dayjs(task.createdAt);
    const end = dayjs(task.deadline);
    return { ...task, start, end };
  });

  const ganttRange = (() => {
    if (ganttTasks.length === 0) return null;
    const minStart = ganttTasks.reduce((min, t) => (t.start.isBefore(min) ? t.start : min), ganttTasks[0].start);
    const maxEnd = ganttTasks.reduce((max, t) => (t.end.isAfter(max) ? t.end : max), ganttTasks[0].end);
    const totalDays = Math.max(maxEnd.diff(minStart, "day"), 1);
    return { minStart, maxEnd, totalDays };
  })();

  const handleAssign = async (e) => {
    e.preventDefault();
    await createTask(form);
    setOpen(false);
    setForm({ projectId: "", userId: "", title: "", description: "", roleContribution: "", deadline: "" });
    load();
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
    <div className="grid gap-6">
      <div id="overview" className="flex flex-wrap items-center justify-between gap-4 scroll-mt-6">
        <div>
          <h1 className="text-3xl font-semibold">Manager Dashboard</h1>
          <p className="text-slate-400">Team overview and task assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost relative" onClick={() => navigate(`/manager/${id}/inbox`)}>
            Emails
            {unreadEmails > 0 && (
              <span className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                {unreadEmails}
              </span>
            )}
          </button>
          <button className="btn-ghost relative" onClick={() => navigate(`/manager/${id}/notifications`)}>
            Notifications
            {unreadNotifications > 0 && (
              <span className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                {unreadNotifications}
              </span>
            )}
          </button>
          <button className="btn-ghost relative" onClick={() => navigate(`/manager/${id}/forum`)}>
            Team Discussion
            {unreadForum > 0 && (
              <span className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                {unreadForum}
              </span>
            )}
          </button>
          {unreadForum > 0 && forumSender && (
            <span className="text-xs text-amber-300">New from {forumSender}</span>
          )}
          <button className="btn-primary" onClick={() => setOpen(true)}>Assign Task</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Team Members" value={team.length} />
        <StatCard label="Active Projects" value={projects.length} />
        <StatCard label="Total Tasks" value={tasks.length} />
        <StatCard label="Time Spent" value={formatDurationHours(totalTimeSpent)} />
      </div>

      <div id="team" className="grid gap-4 md:grid-cols-2 scroll-mt-6">
        <div className="card">
          <h3 className="text-lg font-semibold">Team Members</h3>
          <div className="mt-4 grid gap-2 text-sm">
            {team.map((member) => (
              <div key={member._id} className="flex items-center justify-between">
                <span>{member.name}</span>
                <span className="text-xs text-slate-400">{member.teamRole}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold">Team Snapshot</h3>
          <p className="text-sm text-slate-400">Quick status of team workflow health.</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            <div>Team members: {team.length}</div>
            <div>Total tasks: {tasks.length}</div>
            <div>Time spent: {formatDurationHours(totalTimeSpent)}</div>
          </div>
        </div>
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

      <div id="tasks" className="scroll-mt-6">
        <GlobalSearch />
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            className="btn-ghost"
            onClick={async () => {
              if (selectedTaskIds.length === 0) return;
              await bulkUpdateTasks({ taskIds: selectedTaskIds, update: { status: "in_progress" } });
              setSelectedTaskIds([]);
              load();
            }}
          >
            Bulk In Progress
          </button>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (selectedTaskIds.length === 0) return;
              await bulkUpdateTasks({ taskIds: selectedTaskIds, update: { status: "done" } });
              setSelectedTaskIds([]);
              load();
            }}
          >
            Bulk Done
          </button>
        </div>
        <Table columns={taskColumns} data={taskRows} />
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
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) handleDrop(taskId, stage);
              }}
            >
              <div className="text-xs uppercase text-slate-400">{stage}</div>
              <div className="mt-3 grid gap-2">
                {projectTasks
                  .filter((t) => (t.stage || "Planning") === stage)
                  .map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", task._id)}
                      className="rounded-lg bg-slate-900 p-2 text-xs text-slate-200"
                    >
                      <div className="font-semibold">{task.title}</div>
                      <div className="text-[11px] text-slate-400">{task.roleContribution}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
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
                  load();
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
            <p className="text-sm text-slate-400">Project task timeline overview.</p>
          </div>
          <div className="text-xs text-slate-500">
            {ganttRange
              ? `${ganttRange.minStart.format("MMM D")} – ${ganttRange.maxEnd.format("MMM D")}`
              : "No tasks"}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {ganttTasks.map((task) => {
            if (!ganttRange) return null;
            const offset = Math.max(task.start.diff(ganttRange.minStart, "day"), 0);
            const duration = Math.max(task.end.diff(task.start, "day"), 1);
            const left = (offset / ganttRange.totalDays) * 100;
            const width = (duration / ganttRange.totalDays) * 100;
            return (
              <div key={task._id} className="grid grid-cols-[180px_1fr] items-center gap-3">
                <div className="text-xs text-slate-300">{task.title}</div>
                <div className="relative h-3 rounded-full bg-slate-800">
                  <div
                    className="absolute h-3 rounded-full bg-brand-500"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
          {ganttTasks.length === 0 && (
            <div className="text-sm text-slate-500">No tasks for selected project.</div>
          )}
        </div>
      </div>

      <div id="capacity" className="scroll-mt-6">
        <AvailabilityCard />
      </div>

      <div id="performance" className="scroll-mt-6">
        <PerformanceScorecard />
      </div>

      <Modal open={open} title="Assign Task" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={handleAssign}>
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
    </div>
  );
};

export default ManagerDashboard;
