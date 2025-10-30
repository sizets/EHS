import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import DoctorProfile from "../pages/DoctorProfile";

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const userRole = localStorage.getItem("role");

  // Define public routes where sidebar should not be shown
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  const handleProfileClick = () => {
    if (userRole === "doctor") {
      setShowProfileModal(true);
    }
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false);
  };

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

      {/* Doctor Profile Icon - Bottom Right */}
      {userRole === "doctor" && !isPublicRoute && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleProfileClick}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
            title="My Profile"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                My Profile
              </h2>
              <button
                onClick={handleCloseProfile}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <DoctorProfile />
            </div>
          </div>
        </div>
      )}
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
    case "/departments":
      return "Department Management";
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
    case "/departments":
      return "Manage hospital departments";
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
