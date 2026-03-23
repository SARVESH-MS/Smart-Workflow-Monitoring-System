import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar, { SidebarProfilePanel } from "../components/Sidebar.jsx";
import useMobileMenuSwipe from "../utils/useMobileMenuSwipe.js";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const swipeHandlers = useMobileMenuSwipe({
    isOpen: sidebarOpen,
    onOpen: () => setSidebarOpen(true)
  });

  return (
    <div className={`dashboard-shell min-h-screen grid grid-cols-1 lg:h-screen lg:grid-cols-[260px_1fr] lg:overflow-hidden ${theme === "light" ? "dashboard-theme-light" : "dashboard-theme-dark"}`}>
      <main className="dashboard-main-pane order-1 min-w-0 w-full overflow-x-hidden p-4 pt-24 sm:p-6 sm:pt-6 lg:order-2 lg:h-screen lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <div className="grid min-w-0 gap-4 sm:gap-6">
          <Outlet />
        </div>
      </main>

      <div
        className={`mobile-dashboard-topbar fixed left-3 right-3 top-3 z-20 sm:hidden transition-opacity ${sidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <div className="flex items-center gap-3">
          <div {...swipeHandlers}>
            <button className="mobile-topbar-menu-btn" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu" title="Open menu">
              <span className="mobile-topbar-menu-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mobile-dashboard-brand truncate">SWMS Portal</div>
          </div>
          <SidebarProfilePanel
            user={user}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            compact
            showTitle={false}
            showThemeToggle={false}
            showViewProfileLink={false}
          />
        </div>
      </div>

      <div className="hidden lg:block lg:order-1 lg:h-screen lg:min-h-0">
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
          className={`dashboard-mobile-drawer absolute left-0 top-0 h-full w-[74vw] max-w-[280px] bg-slate-950/80 backdrop-blur transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="h-full overflow-y-auto thin-scrollbar">
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
              showHeader={false}
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

export default AdminLayout;
