import React, { useState } from "react";
import { updatePreferences } from "../api/users.js";
import { useAuth } from "../utils/AuthContext.jsx";

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 text-sm">
    <span>{label}</span>
    <input
      type="checkbox"
      className="h-4 w-4 accent-blue-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

const NotificationSettings = () => {
  const { user, setSession, token } = useAuth();
  const [saving, setSaving] = useState(false);
  const prefs = user?.notificationPrefs || {
    emailDelay: true,
    emailComplete: false,
    smsDelay: false
  };

  const update = async (next) => {
    setSaving(true);
    try {
      const data = await updatePreferences(next);
      setSession(token, data.user);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notifications</h3>
        {saving && <span className="text-xs text-slate-400">Saving...</span>}
      </div>
      <div className="mt-4 grid gap-3 text-slate-300">
        <Toggle
          label="Email on delays"
          checked={prefs.emailDelay}
          onChange={(value) => update({ ...prefs, emailDelay: value })}
        />
        <Toggle
          label="Email on completion"
          checked={prefs.emailComplete}
          onChange={(value) => update({ ...prefs, emailComplete: value })}
        />
        <Toggle
          label="SMS on delays"
          checked={prefs.smsDelay}
          onChange={(value) => update({ ...prefs, smsDelay: value })}
        />
      </div>
    </div>
  );
};

export default NotificationSettings;
