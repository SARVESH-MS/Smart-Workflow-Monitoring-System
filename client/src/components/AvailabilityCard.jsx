import React, { useEffect, useState } from "react";
import { getMyAvailability, saveMyAvailability } from "../api/availability.js";
import dayjs from "dayjs";

const AvailabilityCard = () => {
  const [items, setItems] = useState([]);
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week").format("YYYY-MM-DD"));
  const [capacityHours, setCapacityHours] = useState(40);
  const [timeOffHours, setTimeOffHours] = useState(0);

  const load = async () => {
    const data = await getMyAvailability();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    await saveMyAvailability({ weekStart, capacityHours, timeOffHours });
    setWeekStart(dayjs().startOf("week").format("YYYY-MM-DD"));
    setCapacityHours(40);
    setTimeOffHours(0);
    load();
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Capacity & Availability</h3>
      <p className="text-sm text-slate-400">Plan weekly capacity and time off.</p>
      <div className="mt-4 grid gap-2 text-sm">
        <input
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
        <input
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
          type="number"
          min="0"
          max="80"
          placeholder="Capacity hours"
          value={capacityHours}
          onChange={(e) => setCapacityHours(Number(e.target.value))}
        />
        <input
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm"
          type="number"
          min="0"
          max="80"
          placeholder="Time off hours"
          value={timeOffHours}
          onChange={(e) => setTimeOffHours(Number(e.target.value))}
        />
        <button className="btn-ghost" onClick={save}>Save Availability</button>
      </div>
      <div className="mt-4 text-sm text-slate-300">
        {items.length === 0 && <div className="text-slate-400">No availability saved yet.</div>}
        {items.map((item) => (
          <div key={item._id} className="flex items-center justify-between border-t border-slate-800 py-2">
            <span>{dayjs(item.weekStart).format("MMM D, YYYY")}</span>
            <span>{item.capacityHours}h capacity / {item.timeOffHours}h time off</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityCard;
