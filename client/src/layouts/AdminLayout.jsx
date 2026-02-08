import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import NotificationSettings from "../components/NotificationSettings.jsx";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <Sidebar
        title="Admin"
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

export default AdminLayout;
