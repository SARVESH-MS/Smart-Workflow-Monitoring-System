import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listTasks, startTask, stopTask, completeTask, addTaskProgress } from "../api/tasks.js";
import TimerControls from "../components/TimerControls.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatDate, formatDurationHours } from "../utils/date.js";
import CompletionChart from "../charts/CompletionChart.jsx";
import DelayChart from "../charts/DelayChart.jsx";
import AvailabilityCard from "../components/AvailabilityCard.jsx";
import TaskProgressSummary from "../components/TaskProgressSummary.jsx";
import TaskProgressReview from "../components/TaskProgressReview.jsx";
import DailyProgressStatusBadge from "../components/DailyProgressStatusBadge.jsx";
import { createSocket } from "../utils/socket.js";
import { listMyEmailUnreadCount } from "../api/emails.js";
import { listMyNotificationUnreadCount } from "../api/notifications.js";
import { getUnreadForumCount } from "../api/forum.js";

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
  { value: "commit", label: "Commit" },
  { value: "screenshot", label: "Screenshot" },
  { value: "preview", label: "Preview URL" },
  { value: "figma", label: "Figma" },
  { value: "api_test", label: "API/Test" },
  { value: "document", label: "Document" },
  { value: "issue", label: "Issue/Bug" },
  { value: "other", label: "Other" }
];

const emptyProgressDraft = () => ({
  workType: "other",
  affectedArea: "",
  progressState: "partial",
  evidenceType: "none",
  note: "",
  evidenceUrl: ""
});

const EmployeeDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [unreadEmails, setUnreadEmails] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadForum, setUnreadForum] = useState(0);
  const [forumSender, setForumSender] = useState("");
  const [progressDrafts, setProgressDrafts] = useState({});
  const [submittingProgressTaskId, setSubmittingProgressTaskId] = useState("");
  const [taskFeedback, setTaskFeedback] = useState("");
  const [activeElapsedSec, setActiveElapsedSec] = useState(0);

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

  const load = async () => {
    const data = await listTasks({ userId: id });
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
    const timer = setInterval(loadBadges, 15000);
    return () => clearInterval(timer);
  }, [id]);

  useEffect(() => {
    const socket = createSocket();
    socket.on("task:updated", () => {
      load();
      loadBadges();
    });
    return () => socket.disconnect();
  }, [id]);

  const active = tasks.find((task) => task.status === "in_progress");

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
    setTaskFeedback("");
    try {
      if (nextStatus === "in_progress") {
        await startTask(task._id);
      } else if (nextStatus === "todo") {
        await stopTask(task._id);
      } else if (nextStatus === "done") {
        await completeTask(task._id);
      }
      await load();
    } catch (error) {
      setTaskFeedback(error.response?.data?.message || "Task update failed.");
    }
  };

  const saveProgress = async (taskId) => {
    const draft = getProgressDraft(taskId);
    if (!draft.affectedArea.trim()) {
      setTaskFeedback("Add the page, module, screen, or area you worked on today.");
      return;
    }
    if (!draft.note.trim()) {
      setTaskFeedback("Write today's progress before saving.");
      return;
    }
    setSubmittingProgressTaskId(taskId);
    setTaskFeedback("");
    try {
      const updatedTask = await addTaskProgress(taskId, draft);
      setProgressDrafts((prev) => ({
        ...prev,
        [taskId]: emptyProgressDraft()
      }));
      if (updatedTask?.progressReview?.riskLevel === "high") {
        setTaskFeedback("Today's progress was saved, but it looks very similar to recent updates. Add stronger evidence or clearer changes.");
      } else if (updatedTask?.progressReview?.riskLevel === "warning") {
        setTaskFeedback("Today's progress was saved. The 7-day review suggests the latest proof may need clearer changes.");
      } else {
        setTaskFeedback("Today's progress has been saved.");
      }
      await load();
    } catch (error) {
      setTaskFeedback(error.response?.data?.message || "Saving progress failed.");
    } finally {
      setSubmittingProgressTaskId("");
    }
  };

  const renderProgressForm = (task) => {
    const draft = getProgressDraft(task._id);
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
          <input
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            placeholder={draft.evidenceType === "none" ? "Evidence link optional" : "Evidence link required"}
            value={draft.evidenceUrl}
            onChange={(e) => updateProgressDraft(task._id, { evidenceUrl: e.target.value })}
          />
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
      </div>
    );
  };

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

      {taskFeedback && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          {taskFeedback}
        </div>
      )}

      {active && (
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-400">Current Task</div>
              <div className="text-xl font-semibold">{active.title}</div>
              <div className="text-sm text-slate-400">{active.description || "No details"}</div>
              <div className="text-sm text-slate-500">Deadline: {formatDate(active.deadline)}</div>
              <div className="text-sm text-slate-400">
                Live Time: {formatDurationHours((active.timeSpent || 0) + Math.floor(activeElapsedSec / 60))}
              </div>
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Latest Progress</div>
                <div className="mt-2">
                  <TaskProgressSummary progressLogs={active.progressLogs} />
                </div>
              </div>
              <div className="mt-4">
                <DailyProgressStatusBadge status={active.dailyProgressStatus} />
              </div>
              <div className="mt-4">
                <TaskProgressReview review={active.progressReview} />
              </div>
              <div className="mt-4">{renderProgressForm(active)}</div>
            </div>
            <TimerControls
              running
              onStart={() => changeStatus(active, "in_progress")}
              onStop={() => changeStatus(active, "todo")}
              onComplete={() => changeStatus(active, "done")}
            />
          </div>
        </div>
      )}

      <div id="tasks" className="card min-w-0 scroll-mt-6">
        <div
          className="table-scroll w-full overflow-x-auto overflow-y-hidden thin-scrollbar"
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
                        onClick={() =>
                          setTasks((prev) =>
                            prev.map((item) => (item._id === task._id ? { ...item, _expanded: !item._expanded } : item))
                          )
                        }
                      >
                        <span className="text-xs text-slate-400">{task._expanded ? "▼" : "▶"}</span>
                        <span>{task.title}</span>
                      </button>
                    </td>
                    <td className="break-words py-3 pr-4 text-slate-200">{task.roleContribution}</td>
                    <td className="break-words py-3 pr-4 text-slate-200">{task.deadlineLabel}</td>
                    <td className="break-words py-3 pr-4 text-slate-200">{task.timeSpent}</td>
                    <td className="min-w-[14rem] break-words py-3 pr-4 text-slate-200">
                      <TaskProgressSummary progressLogs={task.progressLogs} />
                      <div className="mt-2">
                        <DailyProgressStatusBadge status={task.dailyProgressStatus} />
                      </div>
                      <TaskProgressReview review={task.progressReview} compact />
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
                        <div className="text-xs uppercase text-slate-500">Task Details</div>
                        <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">
                          {task.description || "No details provided."}
                        </div>
                        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                          <div>
                            <div className="text-xs uppercase text-slate-500">Add Today's Progress</div>
                            <div className="mt-2">{renderProgressForm(task)}</div>
                            <div className="mt-4">
                              <TaskProgressReview review={task.progressReview} />
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-slate-500">Progress Timeline</div>
                            <div className="mt-2 grid gap-2">
                              {(task.progressLogs || []).length === 0 && (
                                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-500">
                                  No progress updates yet.
                                </div>
                              )}
                              {[...(task.progressLogs || [])].reverse().map((log, index) => (
                                <div key={`${task._id}-progress-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                  <div className="text-xs text-slate-500">{new Date(log.loggedAt).toLocaleString()}</div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{log.workType}</span>
                                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{log.progressState}</span>
                                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{log.evidenceType}</span>
                                  </div>
                                  <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">Area: {log.affectedArea}</div>
                                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{log.note}</div>
                                  {log.evidenceUrl ? (
                                    <a
                                      className="mt-2 inline-block break-all text-xs text-blue-400 hover:text-blue-300 hover:underline"
                                      href={log.evidenceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {log.evidenceUrl}
                                    </a>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CompletionChart
          completed={tasks.filter((t) => t.status === "done").length}
          total={tasks.length}
          completedTasks={tasks.filter((t) => t.status === "done")}
          remainingTasks={tasks.filter((t) => t.status !== "done")}
        />
        <DelayChart
          delayed={tasks.filter((t) => t.isDelayed).length}
          onTime={tasks.filter((t) => !t.isDelayed).length}
          delayedTasks={tasks.filter((t) => t.isDelayed)}
          onTimeTasks={tasks.filter((t) => !t.isDelayed)}
        />
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
    </div>
  );
};

export default EmployeeDashboard;
