import React, { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar, { SidebarProfilePanel } from "../components/Sidebar.jsx";
import useMobileMenuSwipe from "../utils/useMobileMenuSwipe.js";

const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const topbarRef = useRef(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("swms_theme") || localStorage.getItem("swms_dashboard_theme") || "dark"
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerTop, setDrawerTop] = useState(92);

  useEffect(() => {
    localStorage.setItem("swms_theme", theme);
    localStorage.setItem("swms_dashboard_theme", theme);
  }, [theme]);

  useEffect(() => {
    const update = () => {
      const el = topbarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDrawerTop(Math.max(Math.round(rect.bottom + 10), 0));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.classList.add("swms-drawer-open");
    document.documentElement.classList.add("swms-drawer-open");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("swms-drawer-open");
      document.documentElement.classList.remove("swms-drawer-open");
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
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
        ref={topbarRef}
        className="mobile-dashboard-topbar fixed left-3 right-3 top-3 z-20 sm:hidden"
      >
        <div className="flex items-center gap-3">
          <div {...swipeHandlers}>
            <button
              className="mobile-topbar-menu-btn"
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              title={sidebarOpen ? "Close menu" : "Open menu"}
            >
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
            showViewProfileLink={false}
          />
        </div>
      </div>

      <div className="hidden lg:block lg:order-1 lg:h-screen lg:min-h-0">
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
        className={`lg:hidden fixed left-0 right-0 bottom-0 z-30 overflow-hidden ${sidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ top: `${drawerTop}px` }}
        aria-hidden={!sidebarOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
        <div
          className={`dashboard-mobile-drawer absolute left-0 top-0 h-full w-[74vw] max-w-[280px] bg-slate-950/80 backdrop-blur transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
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
              showHeader={false}
              onNavigate={() => setSidebarOpen(false)}
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
