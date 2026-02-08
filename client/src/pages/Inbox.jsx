import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import { listMyEmails } from "../api/emails.js";

const Inbox = () => {
  const [emails, setEmails] = useState([]);
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();

  useEffect(() => {
    listMyEmails().then(setEmails);
  }, []);

  const basePath = user?.role === "manager" ? `/manager/${params.id}` : `/employee/${params.id}`;

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <button
          className="h-9 w-9 rounded-full border border-slate-700 text-slate-200 hover:border-slate-500"
          onClick={() => navigate(basePath)}
          aria-label="Back"
          title="Back"
        >
          ←
        </button>
        <div>
          <h2 className="text-xl font-semibold">Inbox</h2>
          <p className="text-sm text-slate-400">System emails sent to you.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        {emails.length === 0 && <div className="text-slate-400">No emails yet.</div>}
        {emails.map((log) => (
          <div key={log._id} className="rounded-xl border border-slate-800 p-3">
            <div className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
            <div className="mt-1 text-slate-200"><strong>Subject:</strong> {log.subject || "-"}</div>
            <div className="mt-2 text-xs text-slate-400">Template: {log.templateKey || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Inbox;
