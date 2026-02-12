import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import NotificationList from "../components/NotificationList.jsx";
import { markAllNotificationsRead } from "../api/notifications.js";

const Notifications = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();

  useEffect(() => {
    markAllNotificationsRead();
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
          {"<-"}
        </button>
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-slate-400">In-app alerts for your tasks.</p>
        </div>
      </div>
      <div className="mt-4">
        <NotificationList />
      </div>
    </div>
  );
};

export default Notifications;
