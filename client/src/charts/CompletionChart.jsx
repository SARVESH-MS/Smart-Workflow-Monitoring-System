import React, { useMemo, useRef, useState } from "react";
import { Doughnut, getElementAtEvent } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import Modal from "../components/Modal.jsx";
import { formatDate } from "../utils/date.js";

ChartJS.register(ArcElement, Tooltip, Legend);

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
    status: task.status
  };
};

const CompletionChart = ({
  completed = 0,
  total = 0,
  completedTasks = null,
  remainingTasks = null,
  loadTaskLists = null
}) => {
  const chartRef = useRef(null);
  const [listOpen, setListOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadedLists, setLoadedLists] = useState(null);

  const completedItems = useMemo(() => {
    if (Array.isArray(completedTasks)) return completedTasks.map(normalizeTask).filter(Boolean);
    if (loadedLists?.completed) return loadedLists.completed.map(normalizeTask).filter(Boolean);
    return null;
  }, [completedTasks, loadedLists?.completed]);

  const remainingItems = useMemo(() => {
    if (Array.isArray(remainingTasks)) return remainingTasks.map(normalizeTask).filter(Boolean);
    if (loadedLists?.remaining) return loadedLists.remaining.map(normalizeTask).filter(Boolean);
    return null;
  }, [remainingTasks, loadedLists?.remaining]);

  const completedCount = completedItems ? completedItems.length : Number(completed || 0);
  const remainingCount = remainingItems
    ? remainingItems.length
    : Math.max(Number(total || 0) - Number(completed || 0), 0);

  const chartData = useMemo(
    () => ({
      labels: ["Completed", "Remaining"],
      datasets: [
        {
          data: [completedCount, remainingCount],
          backgroundColor: ["#3b82f6", "#1f2937"],
          borderWidth: 0
        }
      ]
    }),
    [completedCount, remainingCount]
  );

  const openList = (title, items) => {
    setListTitle(title);
    setListItems(items || []);
    setListOpen(true);
  };

  const ensureLists = async () => {
    if (completedItems && remainingItems) {
      return { completed: completedItems, remaining: remainingItems };
    }
    if (!loadTaskLists) return null;
    setLoadingLists(true);
    try {
      const result = await loadTaskLists();
      const next = {
        completed: Array.isArray(result?.completedTasks) ? result.completedTasks : [],
        remaining: Array.isArray(result?.remainingTasks) ? result.remainingTasks : []
      };
      setLoadedLists(next);
      return {
        completed: next.completed.map(normalizeTask).filter(Boolean),
        remaining: next.remaining.map(normalizeTask).filter(Boolean)
      };
    } finally {
      setLoadingLists(false);
    }
  };

  const openSliceList = async (sliceIndex) => {
    const lists = await ensureLists();
    if (!lists) return;
    if (sliceIndex === 0) openList(`Completed Tasks (${lists.completed.length})`, lists.completed);
    if (sliceIndex === 1) openList(`Remaining Tasks (${lists.remaining.length})`, lists.remaining);
  };

  const handleChartClick = (event) => {
    if (!chartRef.current) return;
    const elements = getElementAtEvent(chartRef.current, event);
    if (!elements?.length) return;
    const sliceIndex = elements[0].index;
    openSliceList(sliceIndex);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Completion Rate</h3>
      <div className="dashboard-chart mt-4 h-28 sm:h-40">
        <Doughnut
          ref={chartRef}
          data={chartData}
          onClick={handleChartClick}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",
            onHover: (event, elements) => {
              const target = event?.native?.target;
              if (!target) return;
              target.style.cursor =
                (loadTaskLists || (completedItems && remainingItems)) && elements?.length ? "pointer" : "default";
            },
            plugins: {
              legend: {
                position: "top",
                labels: { boxWidth: 14 }
              }
            }
          }}
        />
      </div>

      {(loadTaskLists || completedItems || remainingItems) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => openSliceList(0)}
            disabled={loadingLists || (!completedItems && !loadTaskLists)}
            title={!completedItems && !loadTaskLists ? "Task list not available" : "View completed tasks"}
          >
            {loadingLists ? "Loading..." : `Completed: ${completedCount}`}
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => openSliceList(1)}
            disabled={loadingLists || (!remainingItems && !loadTaskLists)}
            title={!remainingItems && !loadTaskLists ? "Task list not available" : "View remaining tasks"}
          >
            {loadingLists ? "Loading..." : `Remaining: ${remainingCount}`}
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
                  {t.status ? <span className="rounded-full border border-slate-700 px-2 py-0.5">Status: {t.status}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CompletionChart;
