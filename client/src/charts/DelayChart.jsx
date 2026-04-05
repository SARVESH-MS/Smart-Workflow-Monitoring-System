import React, { useMemo, useRef, useState } from "react";
import { Bar, getElementAtEvent } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";
import Modal from "../components/Modal.jsx";
import { formatDate } from "../utils/date.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const STATUS_LABELS = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done"
};

const normalizeTask = (task) => {
  if (!task) return null;
  if (typeof task === "string") {
    return { id: task, title: task };
  }
  return {
    id: task._id || task.id || task.title || String(Math.random()),
    title: task.title || "Untitled task",
    projectName: task.projectName || "",
    deadline: task.deadline,
    isDelayed: Boolean(task.isDelayed),
    status: task.status
  };
};

const DelayChart = ({
  delayed = 0,
  onTime = 0,
  delayedTasks = null,
  onTimeTasks = null,
  loadTaskLists = null,
  className = ""
}) => {
  const chartRef = useRef(null);
  const [listOpen, setListOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadedLists, setLoadedLists] = useState(null);

  const delayedItems = useMemo(() => {
    if (Array.isArray(delayedTasks)) return delayedTasks.map(normalizeTask).filter(Boolean);
    if (loadedLists?.delayed) return loadedLists.delayed.map(normalizeTask).filter(Boolean);
    return null;
  }, [delayedTasks, loadedLists?.delayed]);

  const onTimeItems = useMemo(() => {
    if (Array.isArray(onTimeTasks)) return onTimeTasks.map(normalizeTask).filter(Boolean);
    if (loadedLists?.onTime) return loadedLists.onTime.map(normalizeTask).filter(Boolean);
    return null;
  }, [onTimeTasks, loadedLists?.onTime]);

  const delayedCount = delayedItems ? delayedItems.length : Number(delayed || 0);
  const onTimeCount = onTimeItems ? onTimeItems.length : Number(onTime || 0);

  const chartData = useMemo(
    () => ({
      labels: ["On Time", "Delayed"],
      datasets: [
        {
          label: "Tasks",
          data: [onTimeCount, delayedCount],
          backgroundColor: ["#22c55e", "#f97316"]
        }
      ]
    }),
    [delayedCount, onTimeCount]
  );

  const openList = (title, items) => {
    setListTitle(title);
    setListItems(items || []);
    setListOpen(true);
  };

  const ensureLists = async () => {
    if (onTimeItems && delayedItems) {
      return { onTime: onTimeItems, delayed: delayedItems };
    }
    if (!loadTaskLists) return null;
    setLoadingLists(true);
    try {
      const result = await loadTaskLists();
      const next = {
        onTime: Array.isArray(result?.onTimeTasks) ? result.onTimeTasks : [],
        delayed: Array.isArray(result?.delayedTasks) ? result.delayedTasks : []
      };
      setLoadedLists(next);
      return {
        onTime: next.onTime.map(normalizeTask).filter(Boolean),
        delayed: next.delayed.map(normalizeTask).filter(Boolean)
      };
    } finally {
      setLoadingLists(false);
    }
  };

  const openBarList = async (barIndex) => {
    const lists = await ensureLists();
    if (!lists) return;
    if (barIndex === 0) openList(`On Time Tasks (${lists.onTime.length})`, lists.onTime);
    if (barIndex === 1) openList(`Delayed Tasks (${lists.delayed.length})`, lists.delayed);
  };

  const handleChartClick = (event) => {
    if (!chartRef.current) return;
    const elements = getElementAtEvent(chartRef.current, event);
    if (!elements?.length) return;
    const barIndex = elements[0].index;
    openBarList(barIndex);
  };

  return (
    <div className={`card ${className}`.trim()}>
      <h3 className="text-lg font-semibold">Delay Overview</h3>
      <div className="dashboard-chart mt-4 h-28 sm:h-40">
        <Bar
          ref={chartRef}
          data={chartData}
          onClick={handleChartClick}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            onHover: (event, elements) => {
              const target = event?.native?.target;
              if (!target) return;
              target.style.cursor = (loadTaskLists || (onTimeItems && delayedItems)) && elements?.length ? "pointer" : "default";
            },
            plugins: { legend: { display: false } }
          }}
        />
      </div>

      {(loadTaskLists || delayedItems || onTimeItems) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => openBarList(0)}
            disabled={loadingLists || (!onTimeItems && !loadTaskLists)}
            title={!onTimeItems && !loadTaskLists ? "Task list not available" : "View on time tasks"}
          >
            {loadingLists ? "Loading..." : `On Time: ${onTimeCount}`}
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => openBarList(1)}
            disabled={loadingLists || (!delayedItems && !loadTaskLists)}
            title={!delayedItems && !loadTaskLists ? "Task list not available" : "View delayed tasks"}
          >
            {loadingLists ? "Loading..." : `Delayed: ${delayedCount}`}
          </button>
        </div>
      )}

      <Modal open={listOpen} title={listTitle} onClose={() => setListOpen(false)}>
        {listItems.length === 0 ? (
          <div className="text-sm text-slate-400">No tasks to show.</div>
        ) : (
          <div className="grid gap-2">
            {listItems.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="text-sm font-semibold text-slate-100">{t.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {t.projectName ? <span className="rounded-full border border-slate-700 px-2 py-0.5">{t.projectName}</span> : null}
                  {t.deadline ? <span>Deadline: {formatDate(t.deadline)}</span> : null}
                  {t.status ? (
                    <span className="rounded-full border border-slate-700 px-2 py-0.5">
                      Status: {STATUS_LABELS[t.status] || t.status}
                    </span>
                  ) : null}
                  {typeof t.isDelayed === "boolean" ? (
                    <span className={`rounded-full border px-2 py-0.5 ${t.isDelayed ? "border-rose-500/40 text-rose-300" : "border-emerald-500/30 text-emerald-200"}`}>
                      {t.isDelayed ? "Delayed" : "On time"}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DelayChart;
