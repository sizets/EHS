import React from "react";

const Dashboard = () => {
  const userRole = localStorage.getItem("role");

  return (
    <div className="p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Dashboard
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Hello,{" "}
          {userRole
            ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
            : "User"}
          !
        </p>

        <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Hospital Management System
          </h2>
          <p className="text-gray-600 mb-6">
            You are successfully logged in. This is a placeholder dashboard.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Patients</h3>
              <p className="text-blue-700 text-sm">Manage patient records</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Doctors</h3>
              <p className="text-green-700 text-sm">Doctor management</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Appointments</h3>
              <p className="text-purple-700 text-sm">Schedule management</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
