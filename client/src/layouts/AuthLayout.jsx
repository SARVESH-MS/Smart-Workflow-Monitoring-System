import React from "react";
import { Outlet } from "react-router-dom";
import { AuthProvider } from "../utils/AuthContext.jsx";

const AuthLayout = () => (
  <AuthProvider>
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-2">
        <div className="card">
          <h1 className="text-3xl font-semibold">Smart Workflow Monitoring System</h1>
          <p className="mt-4 text-slate-300">
            Track workflows, monitor task progress, and detect delays in real time.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-400">
            <div>Role-based dashboards with JWT authentication.</div>
            <div>Time tracking with start/stop timers per task.</div>
            <div>Live notifications with Socket.io.</div>
          </div>
        </div>
        <div className="card">
          <Outlet />
        </div>
      </div>
    </div>
  </AuthProvider>
);

export default AuthLayout;
