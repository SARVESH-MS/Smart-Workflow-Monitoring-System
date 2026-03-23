import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";

const ManagerLayout = () => {
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

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className={`min-h-screen grid grid-cols-1 lg:h-screen lg:grid-cols-[260px_1fr] lg:overflow-hidden ${theme === "light" ? "dashboard-theme-light" : "dashboard-theme-dark"}`}>
      <main className="order-1 min-w-0 overflow-x-hidden p-4 sm:p-6 lg:order-2 lg:h-screen lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-2 flex justify-end bg-inherit px-4 pt-4 pb-2 sm:hidden">
          <button className="btn-ghost px-3 py-2 text-sm" type="button" onClick={() => setSidebarOpen(true)}>
            Menu
          </button>
        </div>
        <div className="grid min-w-0 gap-4 sm:gap-6">
          <Outlet />
        </div>
      </main>

      <div className="hidden lg:block lg:order-1 lg:h-screen lg:min-h-0">
        <Sidebar
          title={
            <span className="flex flex-col leading-tight">
              <span>{user?.name || "Manager"}</span>
              <span className="text-sm font-normal text-slate-400">(Manager)</span>
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
        className={`lg:hidden fixed inset-0 z-30 overflow-hidden ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
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
                  <span>{user?.name || "Manager"}</span>
                  <span className="text-sm font-normal text-slate-400">(Manager)</span>
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

export default ManagerLayout;
