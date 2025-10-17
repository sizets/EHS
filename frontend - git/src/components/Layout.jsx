import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

const Layout = ({ children }) => {
  const location = useLocation();

  // Define public routes where sidebar should not be shown
  const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {getPageTitle(location.pathname)}
              </h1>
              <p className="text-sm text-gray-600">
                {getPageDescription(location.pathname)}
              </p>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button className="text-gray-700 hover:text-blue-600 focus:outline-none">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

const getPageTitle = (pathname) => {
  switch (pathname) {
    case "/":
      return "Home";
    case "/dashboard":
      return "Dashboard";
    case "/users":
      return "User Management";
    case "/patients":
      return "Patient Management";
    case "/doctors":
      return "Doctor Management";
    case "/appointments":
      return "Appointment Management";
    default:
      return "HospitalMS";
  }
};

const getPageDescription = (pathname) => {
  switch (pathname) {
    case "/":
      return "Welcome to Hospital Management System";
    case "/dashboard":
      return "Overview of hospital operations";
    case "/users":
      return "Manage system users and their roles";
    case "/patients":
      return "Manage patient records and information";
    case "/doctors":
      return "Manage doctor profiles and schedules";
    case "/appointments":
      return "Schedule and manage appointments";
    default:
      return "Hospital Management System";
  }
};

export default Layout;
