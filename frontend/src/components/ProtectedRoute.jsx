import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");
  const location = useLocation();

  // Check if user is authenticated
  if (!token) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role (if specified)
  if (requiredRole) {
    if (Array.isArray(requiredRole)) {
      if (!requiredRole.includes(userRole)) {
        return <Navigate to="/dashboard" replace />;
      }
    } else {
      if (userRole !== requiredRole) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
