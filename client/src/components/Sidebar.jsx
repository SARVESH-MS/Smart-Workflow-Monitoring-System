import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { updatePreferences, updateProfile } from "../api/users.js";

const DARK_MODE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><path d='M22.8 5.2A12.5 12.5 0 1 0 28.8 28a11 11 0 1 1-6-22.8z' fill='%23000000'/></svg>";
const LIGHT_MODE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><g fill='%23f4d73a'><circle cx='17' cy='17' r='7'/><rect x='16' y='2.5' width='2' height='5' rx='1'/><rect x='16' y='26.5' width='2' height='5' rx='1'/><rect x='2.5' y='16' width='5' height='2' rx='1'/><rect x='26.5' y='16' width='5' height='2' rx='1'/><rect x='6.2' y='6.2' width='5' height='2' rx='1' transform='rotate(45 8.7 7.2)'/><rect x='22.8' y='22.8' width='5' height='2' rx='1' transform='rotate(45 25.3 23.8)'/><rect x='22.8' y='6.2' width='5' height='2' rx='1' transform='rotate(-45 25.3 7.2)'/><rect x='6.2' y='22.8' width='5' height='2' rx='1' transform='rotate(-45 8.7 23.8)'/></g></svg>";

const iconClassName = "h-5 w-5 shrink-0";

const SidebarIcon = ({ children }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 text-slate-200">
    {children}
  </span>
);

const OverviewIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const TasksIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="m4 6 1.5 1.5L8 5" />
    <path d="m4 12 1.5 1.5L8 11" />
    <path d="m4 18 1.5 1.5L8 17" />
  </svg>
);

const ReportsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M4 19h16" />
    <path d="M7 15V9" />
    <path d="M12 15V5" />
    <path d="M17 15v-3" />
  </svg>
);

const AlertsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M12 4a5 5 0 0 0-5 5v2.5c0 .8-.3 1.5-.9 2.1L4.8 15a1 1 0 0 0 .7 1.7h13a1 1 0 0 0 .7-1.7l-1.3-1.4a3 3 0 0 1-.9-2.1V9a5 5 0 0 0-5-5Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

const DigestIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M7 9h10" />
    <path d="M7 13h6" />
  </svg>
);

const TemplatesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M6 4h9l3 3v13H6z" />
    <path d="M15 4v4h4" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </svg>
);

const SessionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <rect x="4" y="5" width="16" height="11" rx="2" />
    <path d="M10 20h4" />
    <path d="M12 16v4" />
  </svg>
);

const LoginActivityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M10 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    <path d="M14 7l5 5-5 5" />
    <path d="M19 12H9" />
  </svg>
);

const KanbanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <rect x="4" y="5" width="4" height="14" rx="1.5" />
    <rect x="10" y="5" width="4" height="8" rx="1.5" />
    <rect x="16" y="5" width="4" height="11" rx="1.5" />
  </svg>
);

const TimelineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M5 12h14" />
    <circle cx="7" cy="12" r="2" />
    <circle cx="17" cy="12" r="2" />
    <path d="M12 7v10" />
  </svg>
);

const CapacityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
    <path d="M5 16a7 7 0 1 1 14 0" />
    <path d="m12 12 3-3" />
    <path d="M12 16h.01" />
  </svg>
);

const sidebarButtonClassName =
  "card flex items-center gap-3 text-left text-sm font-medium text-slate-200";

const menuSections = {
  admin: [
    { id: "overview", label: "Overview", icon: <OverviewIcon /> },
    { id: "tasks", label: "Tasks", icon: <TasksIcon /> },
    { id: "reports", label: "Reports", icon: <ReportsIcon /> },
    { id: "alerts", label: "Alerts", icon: <AlertsIcon /> },
    { id: "digest", label: "Notification Digest", icon: <DigestIcon /> },
    { id: "templates", label: "Notification Templates", icon: <TemplatesIcon /> },
    { id: "session-monitor", label: "Session Monitor", icon: <SessionIcon /> },
    { id: "login-activity", label: "Manager & Employee Login Activity", icon: <LoginActivityIcon /> }
  ],
  manager: [
    { id: "overview", label: "Overview", icon: <OverviewIcon /> },
    { id: "tasks", label: "Tasks", icon: <TasksIcon /> },
    { id: "reports", label: "Reports", icon: <ReportsIcon /> },
    { id: "alerts", label: "Alerts", icon: <AlertsIcon /> },
    { id: "kanban", label: "Kanban Board", icon: <KanbanIcon /> },
    { id: "templates", label: "Task Templates & Recurring", icon: <TemplatesIcon /> },
    { id: "gantt", label: "Gantt Timeline", icon: <TimelineIcon /> },
    { id: "capacity", label: "Capacity & Availability", icon: <CapacityIcon /> }
  ],
  employee: [
    { id: "overview", label: "Overview", icon: <OverviewIcon /> },
    { id: "tasks", label: "Tasks", icon: <TasksIcon /> },
    { id: "reports", label: "Reports", icon: <ReportsIcon /> },
    { id: "alerts", label: "Alerts", icon: <AlertsIcon /> },
    { id: "capacity", label: "Capacity & Availability", icon: <CapacityIcon /> }
  ]
};

export const SidebarProfilePanel = ({
  title,
  user,
  theme = "dark",
  onToggleTheme,
  className = "",
  compact = false,
  showThemeToggle = true,
  showTitle = true,
  showViewProfileLink = true
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    email: "",
    id: "",
    avatarUrl: ""
  });
  const [prefsForm, setPrefsForm] = useState({
    emailDelay: true,
    emailComplete: false,
    smsDelay: false
  });

  useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      id: user?.swmsId || "",
      avatarUrl: user?.avatarUrl || ""
    });
    setPrefsForm({
      emailDelay: Boolean(user?.notificationPrefs?.emailDelay),
      emailComplete: Boolean(user?.notificationPrefs?.emailComplete),
      smsDelay: Boolean(user?.notificationPrefs?.smsDelay)
    });
  }, [user]);

  const avatarFallback = useMemo(
    () => (user?.name || "U").trim().charAt(0).toUpperCase(),
    [user?.name]
  );

  const resetProfileDraft = () => {
    setProfileError("");
    setIsEditingProfile(false);
    setProfileForm({
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      id: user?.swmsId || "",
      avatarUrl: user?.avatarUrl || ""
    });
    setPrefsForm({
      emailDelay: Boolean(user?.notificationPrefs?.emailDelay),
      emailComplete: Boolean(user?.notificationPrefs?.emailComplete),
      smsDelay: Boolean(user?.notificationPrefs?.smsDelay)
    });
  };

  const closeProfileModal = () => {
    resetProfileDraft();
    setProfileOpen(false);
  };

  const onAvatarSelect = (event) => {
    if (!isEditingProfile) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Profile picture must be below 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileError("");
      setProfileForm((prev) => ({ ...prev, avatarUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setProfileError("");
      const payload = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        avatarUrl: profileForm.avatarUrl
      };
      const profileData = await updateProfile(payload);
      const prefsData = await updatePreferences(prefsForm);
      const nextUser = prefsData?.user || profileData?.user;
      if (nextUser) {
        localStorage.setItem("swms_user", JSON.stringify(nextUser));
        window.dispatchEvent(new CustomEvent("swms:user-updated", { detail: nextUser }));
      }
      setIsEditingProfile(false);
      setProfileOpen(false);
    } catch (error) {
      setProfileError(error?.response?.data?.message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <div className={className}>
        <div className={`flex ${compact ? "items-center justify-end gap-3" : "items-start justify-between gap-4"}`}>
          {showTitle && (
            <div className={`flex flex-col ${compact ? "min-w-0" : "items-start gap-2"}`}>
              <div className={`${compact ? "truncate text-sm font-semibold text-slate-900" : "text-lg font-semibold"}`}>{title}</div>
              {!compact && showThemeToggle && (
                <button
                  type="button"
                  className="btn-ghost mt-2 h-14 w-14 rounded-2xl p-0 overflow-visible"
                  onClick={onToggleTheme}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <img
                    src={theme === "dark" ? LIGHT_MODE_IMAGE : DARK_MODE_IMAGE}
                    alt={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    className="h-14 w-14 rounded-2xl"
                  />
                </button>
              )}
            </div>
          )}
          {compact && showThemeToggle && (
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-slate-900/60 shadow-sm backdrop-blur transition-transform duration-150 active:scale-95"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <img
                src={theme === "dark" ? LIGHT_MODE_IMAGE : DARK_MODE_IMAGE}
                alt={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="h-5 w-5"
              />
            </button>
          )}
          <div className={`flex ${compact ? "items-center" : "flex-col items-center gap-2"}`}>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className={`${compact ? "h-12 w-12 border-slate-300 bg-white/80 text-base shadow-sm" : "h-20 w-20 border-slate-600 bg-slate-800/80 text-2xl"} shrink-0 aspect-square overflow-hidden rounded-full border-2 font-semibold flex items-center justify-center`}
              title="Open profile"
            >
              {profileForm.avatarUrl ? (
                <img src={profileForm.avatarUrl} alt={user?.name || "Profile"} className="h-full w-full rounded-full object-cover" />
              ) : (
                avatarFallback
              )}
            </button>
            {showViewProfileLink && (
              <button
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300"
                onClick={() => setProfileOpen(true)}
              >
                View Profile
              </button>
            )}
          </div>
        </div>
      </div>
      {profileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 sm:items-center sm:p-4">
            <div className="w-full max-w-2xl max-h-[calc(100vh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:max-h-[90vh] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-100">My Profile</h3>
                  <p className="mt-1 text-sm text-slate-400">Manage your personal details and profile picture.</p>
                </div>
                <button className="btn-ghost px-3 py-1.5" onClick={closeProfileModal}>
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-[180px_1fr]">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 text-3xl font-bold text-slate-200 sm:h-36 sm:w-36">
                    {profileForm.avatarUrl ? (
                      <img
                        src={profileForm.avatarUrl}
                        alt={profileForm.name || "Profile"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      avatarFallback
                    )}
                  </div>
                  {isEditingProfile ? (
                    <label className="btn-ghost cursor-pointer text-sm">
                      Update picture
                      <input type="file" accept="image/*" className="hidden" onChange={onAvatarSelect} />
                    </label>
                  ) : (
                    <span className="text-xs text-slate-400">Click Edit Profile to change picture</span>
                  )}
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">Name</span>
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                      value={profileForm.name}
                      readOnly={!isEditingProfile}
                      disabled={!isEditingProfile}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">Email</span>
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-300"
                      value={profileForm.email}
                      readOnly
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">Phone No</span>
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                      placeholder="+91 9XXXXXXXXX"
                      value={profileForm.phone}
                      readOnly={!isEditingProfile}
                      disabled={!isEditingProfile}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-300">SWMS ID</span>
                    <input
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-300"
                      value={profileForm.id || "ID not assigned"}
                      readOnly
                      disabled
                    />
                  </label>

                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-200">Notifications</span>
                      {!isEditingProfile && <span className="text-xs text-slate-400">View only</span>}
                    </div>
                    <div className="grid gap-2 text-sm text-slate-300">
                      <label className="flex items-center justify-between">
                        <span>Email on delays</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-500"
                          checked={prefsForm.emailDelay}
                          disabled={!isEditingProfile}
                          onChange={(e) => setPrefsForm((prev) => ({ ...prev, emailDelay: e.target.checked }))}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Email on completion</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-500"
                          checked={prefsForm.emailComplete}
                          disabled={!isEditingProfile}
                          onChange={(e) => setPrefsForm((prev) => ({ ...prev, emailComplete: e.target.checked }))}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>SMS on delays</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-500"
                          checked={prefsForm.smsDelay}
                          disabled={!isEditingProfile}
                          onChange={(e) => setPrefsForm((prev) => ({ ...prev, smsDelay: e.target.checked }))}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {profileError && <p className="mt-4 text-sm text-red-400">{profileError}</p>}

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-800 pt-4">
                {isEditingProfile ? (
                  <>
                    <button className="btn-ghost" onClick={closeProfileModal} disabled={savingProfile}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-ghost" onClick={closeProfileModal}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={() => setIsEditingProfile(true)}>
                      Edit Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const Sidebar = ({ title, user, onLogout, theme = "dark", onToggleTheme, showHeader = true, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();

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
    <aside className="sidebar-shell relative flex min-h-0 flex-col overflow-visible border-l border-slate-800 bg-slate-950/60 p-6 lg:h-full lg:overflow-hidden lg:border-l-0 lg:border-r">
      {showHeader && (
        <SidebarProfilePanel
          title={title}
          user={user}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      )}
      <div className={`${showHeader ? "mt-6" : "mt-0"} flex h-auto min-h-0 flex-col overflow-visible pr-1 lg:flex-1 lg:overflow-y-auto lg:thin-scrollbar`}>
        <div className="grid gap-3 text-sm text-slate-300">
          {(menuSections[user?.role] || []).map((item) => (
            <button
              key={item.id}
              className={sidebarButtonClassName}
              onClick={() => {
                goTo(item.id);
                onNavigate?.();
              }}
            >
              <SidebarIcon>{item.icon}</SidebarIcon>
              <span className="min-w-0 leading-snug">{item.label}</span>
            </button>
          ))}
        </div>
        <button
          className="btn-ghost mt-6 flex w-full items-center justify-center gap-3"
          onClick={() => {
            onLogout?.();
            onNavigate?.();
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M10 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            <path d="M14 7l5 5-5 5" />
            <path d="M19 12H9" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
