import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const Sidebar = ({ title, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath =
    user?.role === "admin"
      ? "/admin"
      : user?.role === "manager"
      ? `/manager/${user?.id}`
      : `/employee/${user?.id}`;

  const goTo = (hash) => {
    if (!hash) return;
    const target = `${location.pathname}#${hash}`;
    navigate(target, { replace: false });
    setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <aside className="sticky top-0 h-screen overflow-y-auto p-6 border-r border-slate-800 bg-slate-950/60">
      <div className="text-lg font-semibold">{title}</div>
    <div className="mt-6 card">
      <div className="text-sm text-slate-400">Signed in as</div>
      <div className="font-medium">{user?.name}</div>
      <div className="text-xs text-slate-400">{user?.email}</div>
      <div className="mt-3 inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs uppercase">
        {user?.role}
      </div>
      <div className="mt-3 text-xs text-slate-400">
        Email delay: {user?.notificationPrefs?.emailDelay ? "On" : "Off"}
      </div>
      <div className="text-xs text-slate-400">
        Email complete: {user?.notificationPrefs?.emailComplete ? "On" : "Off"}
      </div>
      <div className="text-xs text-slate-400">
        SMS delay: {user?.notificationPrefs?.smsDelay ? "On" : "Off"}
      </div>
    </div>
      <div className="mt-6 grid gap-3 text-sm text-slate-300">
        {user?.role === "admin" && (
          <>
            <button className="card text-left" onClick={() => goTo("overview")}>Overview</button>
            <button className="card text-left" onClick={() => goTo("tasks")}>Tasks</button>
            <button className="card text-left" onClick={() => goTo("reports")}>Reports</button>
            <button className="card text-left" onClick={() => goTo("alerts")}>Alerts</button>
            <button className="card text-left" onClick={() => goTo("digest")}>Notification Digest</button>
            <button className="card text-left" onClick={() => goTo("templates")}>Notification Templates</button>
          </>
        )}
        {user?.role === "manager" && (
          <>
            <button className="card text-left" onClick={() => goTo("overview")}>Overview</button>
            <button className="card text-left" onClick={() => goTo("tasks")}>Tasks</button>
            <button className="card text-left" onClick={() => goTo("reports")}>Reports</button>
            <button className="card text-left" onClick={() => goTo("alerts")}>Alerts</button>
            <button className="card text-left" onClick={() => goTo("kanban")}>Kanban Board</button>
            <button className="card text-left" onClick={() => goTo("templates")}>Task Templates & Recurring</button>
            <button className="card text-left" onClick={() => goTo("gantt")}>Gantt Timeline</button>
            <button className="card text-left" onClick={() => goTo("capacity")}>Capacity & Availability</button>
            <button className="card text-left" onClick={() => goTo("performance")}>Team Performance</button>
          </>
        )}
        {user?.role === "employee" && (
          <>
            <button className="card text-left" onClick={() => goTo("overview")}>Overview</button>
            <button className="card text-left" onClick={() => goTo("tasks")}>Tasks</button>
            <button className="card text-left" onClick={() => goTo("reports")}>Reports</button>
            <button className="card text-left" onClick={() => goTo("alerts")}>Alerts</button>
            <button className="card text-left" onClick={() => goTo("capacity")}>Capacity & Availability</button>
          </>
        )}
      </div>
    <button className="btn-ghost mt-6 w-full" onClick={onLogout}>
      Logout
    </button>
    </aside>
  );
};

export default Sidebar;
