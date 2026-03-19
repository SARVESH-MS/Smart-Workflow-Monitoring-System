import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "../utils/AuthContext.jsx";

const DARK_MODE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><path d='M22.8 5.2A12.5 12.5 0 1 0 28.8 28a11 11 0 1 1-6-22.8z' fill='%23000000'/></svg>";
const LIGHT_MODE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><g fill='%23f4d73a'><circle cx='17' cy='17' r='7'/><rect x='16' y='2.5' width='2' height='5' rx='1'/><rect x='16' y='26.5' width='2' height='5' rx='1'/><rect x='2.5' y='16' width='5' height='2' rx='1'/><rect x='26.5' y='16' width='5' height='2' rx='1'/><rect x='6.2' y='6.2' width='5' height='2' rx='1' transform='rotate(45 8.7 7.2)'/><rect x='22.8' y='22.8' width='5' height='2' rx='1' transform='rotate(45 25.3 23.8)'/><rect x='22.8' y='6.2' width='5' height='2' rx='1' transform='rotate(-45 25.3 7.2)'/><rect x='6.2' y='22.8' width='5' height='2' rx='1' transform='rotate(-45 8.7 23.8)'/></g></svg>";
const SWMS_LOGO = "/swms-logo.png";
const SWMS_LOGO_LIGHT = "/swms-logo-light.png";

const AuthLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const [activeNav, setActiveNav] = useState("home");
  const [navHint, setNavHint] = useState({ left: false, right: false });
  const [theme, setTheme] = useState(
    () => localStorage.getItem("swms_theme") || localStorage.getItem("swms_auth_theme") || "dark"
  );
  const showAuthPanel =
    location.pathname === "/register" || location.pathname.startsWith("/login");

  useEffect(() => {
    localStorage.setItem("swms_theme", theme);
    localStorage.setItem("swms_auth_theme", theme);
  }, [theme]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const syncNavHint = () => {
      const maxScrollLeft = nav.scrollWidth - nav.clientWidth;
      if (maxScrollLeft <= 4) {
        setNavHint({ left: false, right: false });
        return;
      }

      const atStart = nav.scrollLeft <= 4;
      const atEnd = nav.scrollLeft >= maxScrollLeft - 4;
      setNavHint({
        left: !atStart,
        right: !atEnd
      });
    };

    syncNavHint();
    nav.addEventListener("scroll", syncNavHint, { passive: true });
    window.addEventListener("resize", syncNavHint);

    return () => {
      nav.removeEventListener("scroll", syncNavHint);
      window.removeEventListener("resize", syncNavHint);
    };
  }, [theme, location.pathname]);

  const goToSection = (key) => {
    const container = document.getElementById("landing-scroll");
    const section = document.getElementById(`landing-${key}`);
    if (!container || !section) return;
    const top = Math.max(section.offsetTop - 8, 0);
    container.scrollTo({ top, behavior: "smooth" });
  };

  const handleNav = (key) => {
    setActiveNav(key);
    if (key === "home") {
      if (location.pathname !== "/home") {
        navigate("/home");
      }
      const scrollToTop = () => {
        const container = document.getElementById("landing-scroll");
        if (container) {
          container.scrollTo({ top: 0, behavior: "smooth" });
        }
      };
      requestAnimationFrame(scrollToTop);
      setTimeout(scrollToTop, 0);
      return;
    }
    requestAnimationFrame(() => goToSection(key));
  };

  const openAuth = (path) => {
    if (location.pathname === path) {
      navigate("/home");
      return;
    }
    navigate(path);
    const scrollToTop = () => {
      const container = document.getElementById("landing-scroll");
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    requestAnimationFrame(scrollToTop);
    setTimeout(scrollToTop, 0);
  };

  return (
    <AuthProvider>
      <div className={`landing-shell flex h-screen flex-col overflow-hidden p-2 lg:p-3 ${theme === "light" ? "auth-theme-light" : "auth-theme-dark"}`}>
        <header className="landing-topbar card relative z-40 mb-2 flex min-h-[84px] flex-col gap-3 py-3 lg:h-[84px] lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4 lg:py-4">
          <div className="landing-logo-box flex items-center rounded-lg px-2 py-1">
            {theme === "dark" ? (
              <img src={SWMS_LOGO} alt="SWMS" className="h-11 w-auto" />
            ) : (
              <img src={SWMS_LOGO_LIGHT} alt="SWMS" className="h-11 w-auto" />
            )}
          </div>
          <div className="relative w-full lg:w-auto">
            <nav
              ref={navRef}
              className="flex w-full items-center gap-2 overflow-x-auto no-scrollbar pr-12 text-xs lg:w-auto lg:flex-wrap lg:justify-end lg:overflow-visible lg:pr-0"
            >
              {["home", "features", "modules", "contact"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleNav(item)}
                  className={`landing-nav-btn shrink-0 rounded-full border px-4 py-2 ${
                    activeNav === item
                      ? "border-blue-400 bg-blue-500/20 text-blue-200"
                      : "border-slate-700 bg-slate-900/50 text-slate-300"
                  }`}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => openAuth("/login")}
                className="landing-nav-btn shrink-0 rounded-full border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-300"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openAuth("/register")}
                className="landing-nav-btn shrink-0 rounded-full border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-300"
              >
                Sign Up
              </button>
              <button
                type="button"
                className="landing-icon-btn btn-ghost h-12 w-12 shrink-0 overflow-visible rounded-full p-0"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              >
                <img
                  src={theme === "dark" ? LIGHT_MODE_IMAGE : DARK_MODE_IMAGE}
                  alt={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  className="h-12 w-12 rounded-full"
                />
              </button>
            </nav>
            {navHint.left && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 top-0 flex items-center bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-transparent px-2 lg:hidden"
              >
                <span className="landing-nav-hint">{"<<"}</span>
              </div>
            )}
            {navHint.right && (
              <div
                className="pointer-events-none absolute bottom-0 right-0 top-0 flex items-center bg-gradient-to-l from-slate-950/95 via-slate-950/70 to-transparent px-2 lg:hidden"
              >
                <span className="landing-nav-hint">{">>"}</span>
              </div>
            )}
          </div>
        </header>

        <section
          id="landing-scroll"
          className="landing-scroll-shell card relative z-0 min-h-0 flex-1 overflow-y-auto no-scrollbar"
          onClick={() => {
            if (showAuthPanel) navigate("/home");
          }}
        >
          <div
            id="landing-home"
            className={`mt-2 grid gap-4 transition-[padding] duration-300 ease-out ${showAuthPanel ? "lg:pr-[440px]" : ""}`}
          >
            <h1 className="landing-hero-title text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl md:text-6xl">Smart Workflow Monitoring System</h1>
            <p className="landing-hero-subtitle max-w-3xl text-slate-300">Plan projects, assign work, monitor progress, and detect delivery risks in one real-time operational workspace.</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="landing-hero-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-2xl font-semibold text-slate-100">3 Roles</div>
                <div className="text-xs uppercase text-slate-400">Admin, Manager, Employee</div>
              </div>
              <div className="landing-hero-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-2xl font-semibold text-slate-100">Live</div>
                <div className="text-xs uppercase text-slate-400">Tasks, session, alerts</div>
              </div>
              <div className="landing-hero-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-2xl font-semibold text-slate-100">Unified</div>
                <div className="text-xs uppercase text-slate-400">Mail, notifications, discussion</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="landing-hero-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-sm font-semibold text-slate-100">Why teams use SWMS</div>
                <ul className="mt-2 grid gap-1 text-slate-300">
                  <li>On-time delivery tracking with real-time delay visibility.</li>
                  <li>Manager capacity planning and employee time transparency.</li>
                  <li>Centralized communication with in-app mail + discussion.</li>
                </ul>
              </div>
              <div className="landing-hero-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="text-sm font-semibold text-slate-100">Quick Highlights</div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-slate-800/60 p-2"><div className="text-lg font-semibold text-slate-100">99%</div><div className="text-[11px] text-slate-400">Uptime</div></div>
                  <div className="rounded-lg bg-slate-800/60 p-2"><div className="text-lg font-semibold text-slate-100">24/7</div><div className="text-[11px] text-slate-400">Monitoring</div></div>
                  <div className="rounded-lg bg-slate-800/60 p-2"><div className="text-lg font-semibold text-slate-100">1 Hub</div><div className="text-[11px] text-slate-400">All Work</div></div>
                </div>
              </div>
            </div>
          </div>

          <div id="landing-features" className="mt-6 scroll-mt-2">
            <div className="landing-section-block rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xl font-semibold text-slate-100">Features</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Role-based dashboards for Admin, Manager, and Employee.</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Live task updates, delay alerts, and completion analytics.</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Timer-based time tracking with real-time status visibility.</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">In-app email inbox, notifications, and team discussion.</div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="landing-section-block rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xl font-semibold text-slate-100">Engineering Highlights</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="text-base font-semibold text-slate-100">Backend API Development</div>
                  <p className="mt-2 text-sm text-slate-300">RESTful API routes are properly designed, implemented, and tested using Postman or Thunder Client.</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="text-base font-semibold text-slate-100">Database & Auth Integration</div>
                  <p className="mt-2 text-sm text-slate-300">Successful database connection with secure authentication implemented using JWT.</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="text-base font-semibold text-slate-100">Full-Stack CRUD</div>
                  <p className="mt-2 text-sm text-slate-300">Frontend UI components fetch, display, create, update, and delete data through backend APIs.</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="text-base font-semibold text-slate-100">State Management</div>
                  <p className="mt-2 text-sm text-slate-300">Efficient frontend state handling is implemented using React hooks and context for smooth data flow.</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 md:col-span-2">
                  <div className="text-base font-semibold text-slate-100">Error Handling & Security</div>
                  <p className="mt-2 text-sm text-slate-300">Server-side input validation, secure HTTP headers, and basic audit logging mechanisms are implemented.</p>
                </div>
              </div>
            </div>
          </div>

          <div id="landing-modules" className="mt-6 scroll-mt-2">
            <div className="landing-section-block rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xl font-semibold text-slate-100">Modules</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Admin: approvals, templates, session monitor, login activity.</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Manager: Kanban, Gantt, recurring tasks, capacity planning.</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Employee: assigned tasks, status update, time spent tracking.</div>
              </div>
            </div>
          </div>

          <div id="landing-contact" className="mt-6 scroll-mt-2">
            <div className="landing-section-block rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="text-xl font-semibold text-slate-100">Contact</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Email: ms.sarveshsarvesh.2006@gmail.com</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Phone: +91 9865138288</div>
                <div className="landing-item rounded-lg bg-slate-800/50 p-3">Hours: Mon-Fri, 9:00 AM - 6:00 PM</div>
              </div>
            </div>
          </div>

          {showAuthPanel && (
            <div className="pointer-events-none absolute inset-0 z-30 hidden md:block">
              <section
                className="landing-auth-panel pointer-events-auto card absolute right-2 top-2 max-h-[calc(100vh-130px)] w-[420px] overflow-y-auto overscroll-contain no-scrollbar border border-slate-800/80 bg-slate-900/55"
                onClick={(e) => e.stopPropagation()}
              >
                <Outlet />
              </section>
            </div>
          )}

          {showAuthPanel && (
            <div className="mt-8 block md:hidden">
              <section
                className="landing-auth-panel card max-h-[72vh] max-w-xl overflow-y-auto overscroll-contain no-scrollbar border border-slate-800/80 bg-slate-900/50"
                onClick={(e) => e.stopPropagation()}
              >
                <Outlet />
              </section>
            </div>
          )}
        </section>
      </div>
    </AuthProvider>
  );
};

export default AuthLayout;
