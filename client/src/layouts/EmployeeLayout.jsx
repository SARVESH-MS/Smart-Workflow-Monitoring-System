import React from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import NotificationSettings from "../components/NotificationSettings.jsx";

const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <Sidebar
        title={
          <span className="flex flex-wrap items-baseline gap-2">
            <span>Employee</span>
            <span className="text-xs text-slate-400">{id}</span>
          </span>
        }
        user={user}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />
      <main className="p-6 grid gap-6">
        <NotificationSettings />
        <Outlet />
      </main>
    </div>
  );
};

export default EmployeeLayout;
