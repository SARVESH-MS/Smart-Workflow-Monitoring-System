import React from "react";

const StatCard = ({ label, value, hint }) => (
  <div className="card dashboard-stat-card">
    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="dashboard-stat-value mt-2 text-3xl font-semibold text-slate-100">{value}</div>
    {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
  </div>
);

export default StatCard;
