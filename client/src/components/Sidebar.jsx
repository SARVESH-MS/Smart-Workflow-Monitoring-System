import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { updatePreferences, updateProfile } from "../api/users.js";

const DARK_MODE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><path d='M22.8 5.2A12.5 12.5 0 1 0 28.8 28a11 11 0 1 1-6-22.8z' fill='%23000000'/></svg>";
const LIGHT_MODE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><g fill='%23f4d73a'><circle cx='17' cy='17' r='7'/><rect x='16' y='2.5' width='2' height='5' rx='1'/><rect x='16' y='26.5' width='2' height='5' rx='1'/><rect x='2.5' y='16' width='5' height='2' rx='1'/><rect x='26.5' y='16' width='5' height='2' rx='1'/><rect x='6.2' y='6.2' width='5' height='2' rx='1' transform='rotate(45 8.7 7.2)'/><rect x='22.8' y='22.8' width='5' height='2' rx='1' transform='rotate(45 25.3 23.8)'/><rect x='22.8' y='6.2' width='5' height='2' rx='1' transform='rotate(-45 25.3 7.2)'/><rect x='6.2' y='22.8' width='5' height='2' rx='1' transform='rotate(-45 8.7 23.8)'/></g></svg>";

const Sidebar = ({ title, user, onLogout, theme = "dark", onToggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
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

  const onAvatarSelect = (event) => {
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
      const data = await updateProfile(payload);
      if (data?.user) {
        localStorage.setItem("swms_user", JSON.stringify(data.user));
        window.dispatchEvent(new CustomEvent("swms:user-updated", { detail: data.user }));
      }
      setProfileOpen(false);
    } catch (error) {
      setProfileError(error?.response?.data?.message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async (nextPrefs) => {
    try {
      setSavingPrefs(true);
      const data = await updatePreferences(nextPrefs);
      if (data?.user) {
        localStorage.setItem("swms_user", JSON.stringify(data.user));
        window.dispatchEvent(new CustomEvent("swms:user-updated", { detail: data.user }));
        setPrefsForm({
          emailDelay: Boolean(data.user?.notificationPrefs?.emailDelay),
          emailComplete: Boolean(data.user?.notificationPrefs?.emailComplete),
          smsDelay: Boolean(data.user?.notificationPrefs?.smsDelay)
        });
      }
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <aside className="sidebar-shell relative overflow-visible p-6 border-l border-slate-800 bg-slate-950/60 lg:border-l-0 lg:border-r lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex flex-col items-start gap-2">
          <div className="text-lg font-semibold">{title}</div>
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
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="h-20 w-20 shrink-0 aspect-square overflow-hidden rounded-full border-2 border-slate-600 bg-slate-800/80 text-2xl font-semibold flex items-center justify-center"
            title="Open profile"
          >
            {profileForm.avatarUrl ? (
              <img src={profileForm.avatarUrl} alt={user?.name || "Profile"} className="h-full w-full rounded-full object-cover" />
            ) : (
              avatarFallback
            )}
          </button>
          <button
            type="button"
            className="text-xs text-blue-400 hover:text-blue-300"
            onClick={() => setProfileOpen(true)}
          >
            View Profile
          </button>
        </div>
      </div>
      <div className="mt-6 flex h-auto min-h-0 flex-col overflow-visible pr-1 lg:h-[calc(100vh-220px)] lg:overflow-y-auto lg:thin-scrollbar">
        <div className="grid gap-3 text-sm text-slate-300">
          {user?.role === "admin" && (
            <>
              <button className="card text-left" onClick={() => goTo("overview")}>Overview</button>
              <button className="card text-left" onClick={() => goTo("tasks")}>Tasks</button>
              <button className="card text-left" onClick={() => goTo("reports")}>Reports</button>
              <button className="card text-left" onClick={() => goTo("alerts")}>Alerts</button>
              <button className="card text-left" onClick={() => goTo("digest")}>Notification Digest</button>
              <button className="card text-left" onClick={() => goTo("templates")}>Notification Templates</button>
              <button className="card text-left" onClick={() => goTo("session-monitor")}>Session Monitor</button>
              <button className="card text-left" onClick={() => goTo("login-activity")}>Manager & Employee Login Activity</button>
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
      </div>
    {profileOpen &&
      createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-slate-100">My Profile</h3>
              <p className="mt-1 text-sm text-slate-400">Manage your personal details and profile picture.</p>
            </div>
            <button className="btn-ghost px-3 py-1.5" onClick={() => setProfileOpen(false)}>
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-36 w-36 overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-200">
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
              <label className="btn-ghost cursor-pointer text-sm">
                Update picture
                <input type="file" accept="image/*" className="hidden" onChange={onAvatarSelect} />
              </label>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-300">Name</span>
                <input
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  value={profileForm.name}
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
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  placeholder="+91 9XXXXXXXXX"
                  value={profileForm.phone}
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
                  {savingPrefs && <span className="text-xs text-slate-400">Saving...</span>}
                </div>
                <div className="grid gap-2 text-sm text-slate-300">
                  <label className="flex items-center justify-between">
                    <span>Email on delays</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-500"
                      checked={prefsForm.emailDelay}
                      onChange={(e) => {
                        const next = { ...prefsForm, emailDelay: e.target.checked };
                        setPrefsForm(next);
                        savePreferences(next);
                      }}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Email on completion</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-500"
                      checked={prefsForm.emailComplete}
                      onChange={(e) => {
                        const next = { ...prefsForm, emailComplete: e.target.checked };
                        setPrefsForm(next);
                        savePreferences(next);
                      }}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>SMS on delays</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-500"
                      checked={prefsForm.smsDelay}
                      onChange={(e) => {
                        const next = { ...prefsForm, smsDelay: e.target.checked };
                        setPrefsForm(next);
                        savePreferences(next);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {profileError && <p className="mt-4 text-sm text-red-400">{profileError}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <button className="btn-ghost" onClick={() => setProfileOpen(false)} disabled={savingProfile}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </aside>
  );
};

export default Sidebar;
