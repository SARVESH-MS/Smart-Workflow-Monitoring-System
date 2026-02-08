import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listTasks, startTask, stopTask, completeTask } from "../api/tasks.js";
import TimerControls from "../components/TimerControls.jsx";
import StatCard from "../components/StatCard.jsx";
import Table from "../components/Table.jsx";
import { formatDate, formatDurationHours } from "../utils/date.js";
import CompletionChart from "../charts/CompletionChart.jsx";
import DelayChart from "../charts/DelayChart.jsx";
import AvailabilityCard from "../components/AvailabilityCard.jsx";
import NotificationList from "../components/NotificationList.jsx";
import { createSocket } from "../utils/socket.js";

const EmployeeDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);

  const load = async () => {
    const data = await listTasks({ userId: id });
    setTasks(data);
  };

  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    const socket = createSocket();
    socket.on("task:updated", load);
    return () => socket.disconnect();
  }, [id]);

  const active = tasks.find((task) => task.status === "in_progress");
  const [activeElapsedSec, setActiveElapsedSec] = useState(0);

  useEffect(() => {
    if (!active || !active.startTime) {
      setActiveElapsedSec(0);
      return undefined;
    }
    const tick = () => {
      const start = new Date(active.startTime).getTime();
      const now = Date.now();
      const sec = Math.max(Math.floor((now - start) / 1000), 0);
      setActiveElapsedSec(sec);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active?._id, active?.startTime]);
  const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);

  const columns = useMemo(
    () => [
      { key: "title", label: "Task" },
      { key: "description", label: "Details" },
      { key: "roleContribution", label: "Role" },
      { key: "deadline", label: "Deadline" },
      { key: "timeSpent", label: "Time Spent" },
      { key: "status", label: "Status" }
    ],
    []
  );

  const rows = tasks.map((task) => {
    const extraMinutes =
      task.status === "in_progress" && task.startTime
        ? Math.floor(activeElapsedSec / 60)
        : 0;
    return {
      ...task,
      description: task.description || "-",
      timeSpent: formatDurationHours((task.timeSpent || 0) + extraMinutes),
      deadline: formatDate(task.deadline)
    };
  });

  const changeStatus = async (task, nextStatus) => {
    if (nextStatus === "in_progress") {
      await startTask(task._id);
    } else if (nextStatus === "todo") {
      await stopTask(task._id);
    } else if (nextStatus === "done") {
      await completeTask(task._id);
    }
    load();
  };

  return (
    <div className="grid gap-6">
      <div id="overview" className="grid gap-4 lg:grid-cols-[1.2fr_1fr] items-start scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Employee Dashboard</h1>
            <p className="text-slate-400">Track your tasks and time</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={() => navigate(`/employee/${id}/inbox`)}>Emails</button>
            <button className="btn-ghost" onClick={() => navigate(`/employee/${id}/forum`)}>Team Discussion</button>
          </div>
        </div>
      <div id="alerts" className="card">
        <h3 className="text-lg font-semibold">Upcoming Deadlines</h3>
        <div className="mt-4 grid gap-2 text-sm text-slate-300">
          {tasks.slice(0, 3).map((task) => (
            <div key={task._id} className="flex items-center justify-between">
              <span>{task.title}</span>
              <span className="text-xs text-slate-400">{formatDate(task.deadline)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

      <NotificationList />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Assigned Tasks" value={tasks.length} />
        <StatCard label="Active Task" value={active?.title || "None"} />
        <StatCard label="Delayed" value={tasks.filter((t) => t.isDelayed).length} />
        <StatCard label="Time Spent" value={formatDurationHours(totalTimeSpent)} />
      </div>

      {active && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-slate-400">Current Task</div>
              <div className="text-xl font-semibold">{active.title}</div>
              <div className="text-sm text-slate-400">{active.description || "No details"}</div>
              <div className="text-sm text-slate-500">Deadline: {formatDate(active.deadline)}</div>
              <div className="text-sm text-slate-400">
                Live Time: {formatDurationHours((active.timeSpent || 0) + Math.floor(activeElapsedSec / 60))}
              </div>
            </div>
            <TimerControls
              running
              onStart={() => startTask(active._id).then(load)}
              onStop={() => stopTask(active._id).then(load)}
              onComplete={() => completeTask(active._id).then(load)}
            />
          </div>
        </div>
      )}

      <div id="tasks" className="card overflow-auto scroll-mt-6">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="py-3 pr-4">Task</th>
              <th className="py-3 pr-4">Role</th>
              <th className="py-3 pr-4">Deadline</th>
              <th className="py-3 pr-4">Time Spent</th>
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
                          prev.map((t) =>
                            t._id === task._id ? { ...t, _expanded: !t._expanded } : t
                          )
                        )
                      }
                    >
                      <span className="text-xs text-slate-400">
                        {task._expanded ? "▾" : "▸"}
                      </span>
                      <span>{task.title}</span>
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-slate-200">{task.roleContribution}</td>
                  <td className="py-3 pr-4 text-slate-200">{task.deadline}</td>
                  <td className="py-3 pr-4 text-slate-200">{task.timeSpent}</td>
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
                    <td className="py-3 pr-4 text-slate-300" colSpan={5}>
                      <div className="text-xs uppercase text-slate-500">Task Details</div>
                      <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">
                        {task.description || "No details provided."}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CompletionChart
          completed={tasks.filter((t) => t.status === "done").length}
          total={tasks.length}
        />
        <DelayChart
          delayed={tasks.filter((t) => t.isDelayed).length}
          onTime={tasks.filter((t) => !t.isDelayed).length}
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
