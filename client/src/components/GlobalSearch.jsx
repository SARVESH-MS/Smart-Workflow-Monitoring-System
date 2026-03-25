import React, { useEffect, useState } from "react";
import { searchAll } from "../api/search.js";

const GlobalSearch = () => {
  const [q, setQ] = useState("");
  const [result, setResult] = useState({ tasks: [], projects: [], users: [] });

  useEffect(() => {
    const id = setTimeout(() => {
      if (q.trim().length === 0) {
        setResult({ tasks: [], projects: [], users: [] });
        return;
      }
      searchAll(q).then(setResult);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="card">
      <div className="text-sm font-semibold">Global Search</div>
      <input
        className="global-search-field mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-400"
        placeholder="Search tasks, projects, users"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-4 grid gap-3 text-sm">
        {result.projects.length > 0 && (
          <div>
            <div className="text-xs uppercase text-slate-400">Projects</div>
            <div className="mt-2 grid gap-1">
              {result.projects.map((p) => (
                <div key={p._id} className="text-slate-200">{p.name}</div>
              ))}
            </div>
          </div>
        )}
        {result.tasks.length > 0 && (
          <div>
            <div className="text-xs uppercase text-slate-400">Tasks</div>
            <div className="mt-2 grid gap-1">
              {result.tasks.map((t) => (
                <div key={t._id} className="text-slate-200">{t.title}</div>
              ))}
            </div>
          </div>
        )}
        {result.users.length > 0 && (
          <div>
            <div className="text-xs uppercase text-slate-400">Users</div>
            <div className="mt-2 grid gap-1">
              {result.users.map((u) => (
                <div key={u._id} className="text-slate-200">{u.name} ({u.email})</div>
              ))}
            </div>
          </div>
        )}
        {q && result.projects.length === 0 && result.tasks.length === 0 && result.users.length === 0 && (
          <div className="text-slate-400">No results</div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;
