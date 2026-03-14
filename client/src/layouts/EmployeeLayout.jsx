import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";

const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("swms_theme") || localStorage.getItem("swms_dashboard_theme") || "dark"
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("swms_theme", theme);
    localStorage.setItem("swms_dashboard_theme", theme);
  }, [theme]);

  return (
    <div className={`min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr] ${theme === "light" ? "dashboard-theme-light" : "dashboard-theme-dark"}`}>
      <div className="lg:hidden fixed right-4 top-4 z-40">
        <button className="btn-ghost px-3 py-2 text-sm" type="button" onClick={() => setSidebarOpen(true)}>
          Menu
        </button>
      </div>

      <main className="order-1 lg:order-2 p-4 sm:p-6 grid gap-4 sm:gap-6 overflow-x-hidden">
        <Outlet />
      </main>

      <div className="hidden lg:block order-2 lg:order-1">
        <Sidebar
          title={
            <span className="flex flex-col leading-tight">
              <span>{user?.name || "Employee"}</span>
              <span className="text-sm font-normal text-slate-400">(Employee)</span>
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
      </div>

      <div
        className={`lg:hidden fixed inset-0 z-30 ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!sidebarOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/40 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
        <div
          className={`absolute right-0 top-0 h-full w-[82vw] max-w-[320px] bg-slate-950/80 backdrop-blur transition-transform ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="h-full overflow-y-auto thin-scrollbar">
            <Sidebar
              title={
                <span className="flex flex-col leading-tight">
                  <span>{user?.name || "Employee"}</span>
                  <span className="text-sm font-normal text-slate-400">(Employee)</span>
                </span>
              }
              user={user}
              theme={theme}
              onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              onLogout={() => {
                setSidebarOpen(false);
                logout();
                navigate("/login");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLayout;
