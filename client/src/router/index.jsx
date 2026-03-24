import React, { Suspense, lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "../utils/ProtectedRoute.jsx";

const AuthLayout = lazy(() => import("../layouts/AuthLayout.jsx"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout.jsx"));
const ManagerLayout = lazy(() => import("../layouts/ManagerLayout.jsx"));
const EmployeeLayout = lazy(() => import("../layouts/EmployeeLayout.jsx"));
const Login = lazy(() => import("../pages/Login.jsx"));
const Register = lazy(() => import("../pages/Register.jsx"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard.jsx"));
const ManagerDashboard = lazy(() => import("../pages/ManagerDashboard.jsx"));
const EmployeeDashboard = lazy(() => import("../pages/EmployeeDashboard.jsx"));
const Forum = lazy(() => import("../pages/Forum.jsx"));
const Inbox = lazy(() => import("../pages/Inbox.jsx"));
const Notifications = lazy(() => import("../pages/Notifications.jsx"));
const NotFound = lazy(() => import("../pages/NotFound.jsx"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300">
    Loading...
  </div>
);

const withSuspense = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

const router = createBrowserRouter([
  {
    element: withSuspense(<AuthLayout />),
    children: [
      { path: "/", element: <Navigate to="/home" replace /> },
      { path: "/home", element: null },
      { path: "/login", element: withSuspense(<Login />) },
      { path: "/login/admin", element: withSuspense(<Login role="admin" />) },
      { path: "/login/manager", element: withSuspense(<Login role="manager" />) },
      { path: "/login/employee", element: withSuspense(<Login role="employee" />) },
      { path: "/register", element: withSuspense(<Register />) }
    ]
  },
  {
    path: "/admin",
    element: withSuspense(
      <ProtectedRoute roles={["admin"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: withSuspense(<AdminDashboard />) }]
  },
  {
    path: "/manager/:id",
    element: withSuspense(
      <ProtectedRoute roles={["manager"]}>
        <ManagerLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: withSuspense(<ManagerDashboard />) },
      { path: "forum", element: withSuspense(<Forum />) },
      { path: "inbox", element: withSuspense(<Inbox />) },
      { path: "notifications", element: withSuspense(<Notifications />) }
    ]
  },
  {
    path: "/employee/:id",
    element: withSuspense(
      <ProtectedRoute roles={["employee"]}>
        <EmployeeLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: withSuspense(<EmployeeDashboard />) },
      { path: "forum", element: withSuspense(<Forum />) },
      { path: "inbox", element: withSuspense(<Inbox />) },
      { path: "notifications", element: withSuspense(<Notifications />) }
    ]
  },
  { path: "*", element: withSuspense(<NotFound />) }
]);

export default router;
