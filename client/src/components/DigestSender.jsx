import React, { useState } from "react";
import { sendDigest } from "../api/digests.js";

const DigestSender = () => {
  const [role, setRole] = useState("manager");
  const [frequency, setFrequency] = useState("weekly");
  const [status, setStatus] = useState("");

  const handleSend = async () => {
    const res = await sendDigest({ role, frequency });
    setStatus(`Sent to ${res.sent} users`);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Notification Digest</h3>
      <p className="text-sm text-slate-400">Send a daily/weekly summary email.</p>
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select
          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm sm:w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>
        <select
          className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm sm:w-auto"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button className="btn-ghost w-full sm:w-auto" onClick={handleSend}>Send Digest</button>
      </div>
      {status && <div className="mt-2 text-xs text-slate-400">{status}</div>}
    </div>
  );
};

export default DigestSender;
