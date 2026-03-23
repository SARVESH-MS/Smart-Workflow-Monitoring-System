import React from "react";

const StatCard = ({ label, value, hint }) => (
  <div className="card">
    <div className="text-sm text-slate-400">{label}</div>
    <div className="dashboard-stat-value mt-2 text-3xl font-semibold">{value}</div>
    {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
  </div>
);

export default StatCard;
