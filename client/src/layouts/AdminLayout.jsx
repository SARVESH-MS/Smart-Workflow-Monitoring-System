import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("swms_theme") || localStorage.getItem("swms_dashboard_theme") || "dark"
  );

  useEffect(() => {
    localStorage.setItem("swms_theme", theme);
    localStorage.setItem("swms_dashboard_theme", theme);
  }, [theme]);

  return (
    <div className={`min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr] ${theme === "light" ? "dashboard-theme-light" : "dashboard-theme-dark"}`}>
      <Sidebar
        title={
          <span className="flex flex-col leading-tight">
            <span>{user?.name || "Admin"}</span>
            <span className="text-sm font-normal text-slate-400">(Admin)</span>
          </span>
        }
        user={user}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />
      <main className="p-6 grid gap-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
