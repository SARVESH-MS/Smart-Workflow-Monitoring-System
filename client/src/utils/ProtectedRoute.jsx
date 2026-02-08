import React from "react";
import { Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";

const Gate = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
};

const ProtectedRoute = ({ roles, children }) => (
  <AuthProvider>
    <Gate roles={roles}>{children}</Gate>
  </AuthProvider>
);

export default ProtectedRoute;
