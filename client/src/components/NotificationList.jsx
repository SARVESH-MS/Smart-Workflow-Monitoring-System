import React, { useEffect, useState } from "react";
import { listMyNotifications, markNotificationRead } from "../api/notifications.js";

const NotificationList = () => {
  const [items, setItems] = useState([]);

  const load = async () => {
    const data = await listMyNotifications();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Notifications</h3>
      <p className="text-sm text-slate-400">In-app alerts for your tasks.</p>
      <div className="mt-4 grid gap-2 text-sm">
        {items.length === 0 && <div className="text-slate-400">No notifications yet.</div>}
        {items.map((n) => (
          <div key={n._id} className="rounded-xl border border-slate-800 p-3">
            <div className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</div>
            <div className="mt-1 text-slate-200 font-semibold">{n.title}</div>
            <div className="text-slate-300 text-sm">{n.message}</div>
            {!n.read && (
              <button
                className="mt-2 btn-ghost"
                onClick={async () => {
                  await markNotificationRead(n._id);
                  setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
                }}
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationList;
