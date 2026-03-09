import { Navigate, createBrowserRouter } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";
import ManagerLayout from "../layouts/ManagerLayout.jsx";
import EmployeeLayout from "../layouts/EmployeeLayout.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import AdminDashboard from "../pages/AdminDashboard.jsx";
import ManagerDashboard from "../pages/ManagerDashboard.jsx";
import EmployeeDashboard from "../pages/EmployeeDashboard.jsx";
import Forum from "../pages/Forum.jsx";
import Inbox from "../pages/Inbox.jsx";
import Notifications from "../pages/Notifications.jsx";
import NotFound from "../pages/NotFound.jsx";
import ProtectedRoute from "../utils/ProtectedRoute.jsx";

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/", element: <Navigate to="/home" replace /> },
      { path: "/home", element: null },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> }
    ]
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute roles={["admin"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <AdminDashboard /> }]
  },
  {
    path: "/manager/:id",
    element: (
      <ProtectedRoute roles={["manager"]}>
        <ManagerLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <ManagerDashboard /> },
      { path: "forum", element: <Forum /> },
      { path: "inbox", element: <Inbox /> },
      { path: "notifications", element: <Notifications /> }
    ]
  },
  {
    path: "/employee/:id",
    element: (
      <ProtectedRoute roles={["employee"]}>
        <EmployeeLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <EmployeeDashboard /> },
      { path: "forum", element: <Forum /> },
      { path: "inbox", element: <Inbox /> },
      { path: "notifications", element: <Notifications /> }
    ]
  },
  { path: "*", element: <NotFound /> }
]);

export default router;
