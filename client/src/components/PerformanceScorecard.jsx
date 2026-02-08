import React, { useEffect, useState } from "react";
import { teamPerformance } from "../api/performance.js";

const PerformanceScorecard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    teamPerformance().then(setData);
  }, []);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Team Performance</h3>
      <p className="text-sm text-slate-400">Completion rate, delays, and average time.</p>
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <div>Total Tasks: {data?.total ?? 0}</div>
        <div>Completed: {data?.completed ?? 0}</div>
        <div>Delayed: {data?.delayed ?? 0}</div>
        <div>Completion Rate: {data?.completionRate ?? 0}%</div>
        <div>Avg Time: {data?.avgTime ?? 0} mins</div>
      </div>
    </div>
  );
};

export default PerformanceScorecard;
