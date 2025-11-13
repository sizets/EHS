import React, { useState, useEffect } from "react";
import { hmsApi } from "../services/api";

const DoctorManagement = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorAssignments, setDoctorAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const response = await hmsApi.getUsersByRole("doctor");
      setDoctors(response.users || []);
    } catch (err) {
      setError("Failed to load doctors: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDoctor = async (doctor) => {
    setSelectedDoctor(doctor);
    setLoadingAssignments(true);
    try {
      const response = await hmsApi.getAssignmentsByDoctor(doctor.id);
      setDoctorAssignments(response.assignments || []);
    } catch (err) {
      setError("Failed to load doctor assignments: " + err.message);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleBackToList = () => {
    setSelectedDoctor(null);
    setDoctorAssignments([]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type) => {
    return type === "emergency"
      ? "text-red-600 font-semibold"
      : "text-green-600 font-semibold";
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "critical":
        return "text-red-700 font-bold";
      case "high":
        return "text-red-600 font-semibold";
      case "medium":
        return "text-yellow-600 font-semibold";
      case "normal":
        return "text-green-600";
      case "low":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getUniquePatients = () => {
    const uniquePatients = new Map();
    doctorAssignments.forEach((assignment) => {
      if (!uniquePatients.has(assignment.patientId)) {
        uniquePatients.set(assignment.patientId, {
          id: assignment.patientId,
          name: assignment.patientName,
          totalAssignments: 0,
          completedAssignments: 0,
          lastAssignment: assignment.assignedAt,
        });
      }
      const patient = uniquePatients.get(assignment.patientId);
      patient.totalAssignments++;
      if (assignment.status === "completed") {
        patient.completedAssignments++;
      }
      if (new Date(assignment.assignedAt) > new Date(patient.lastAssignment)) {
        patient.lastAssignment = assignment.assignedAt;
      }
    });
    return Array.from(uniquePatients.values());
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedDoctor) {
    // Doctor Detail View
    const uniquePatients = getUniquePatients();

    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBackToList}
            className="mr-4 px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            ← Back to Doctors
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            Dr. {selectedDoctor.name}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Doctor Info */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Doctor Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p>
                <span className="font-medium">Name:</span> {selectedDoctor.name}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {selectedDoctor.email}
              </p>
              <p>
                <span className="font-medium">Phone:</span>{" "}
                {selectedDoctor.phone || "Not provided"}
              </p>
            </div>
            <div>
              <p>
                <span className="font-medium">Specialization:</span>{" "}
                {selectedDoctor.specialization || "General"}
              </p>
              <p>
                <span className="font-medium">Department:</span>{" "}
                {selectedDoctor.departmentName || "Not assigned"}
              </p>
              <p>
                <span className="font-medium">Joined:</span>{" "}
                {formatDate(selectedDoctor.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Patient Summary */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Patient Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Total Patients</h3>
              <p className="text-2xl font-bold text-blue-700">
                {uniquePatients.length}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">
                Total Assignments
              </h3>
              <p className="text-2xl font-bold text-green-700">
                {doctorAssignments.length}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Completed Cases</h3>
              <p className="text-2xl font-bold text-purple-700">
                {
                  doctorAssignments.filter((a) => a.status === "completed")
                    .length
                }
              </p>
            </div>
          </div>
        </div>

        {/* Patient List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Patients Treated
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Assignments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Assignment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uniquePatients.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No patients assigned to this doctor
                    </td>
                  </tr>
                ) : (
                  uniquePatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {patient.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {patient.id.slice(-8)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {patient.totalAssignments}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {patient.completedAssignments}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(patient.lastAssignment)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assignment History */}
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Assignment History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type & Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingAssignments ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : doctorAssignments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No assignments found
                    </td>
                  </tr>
                ) : (
                  doctorAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.patientName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {assignment.patientId.slice(-8)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div
                            className={`text-sm ${getTypeColor(
                              assignment.assignmentType
                            )}`}
                          >
                            {assignment.assignmentType.charAt(0).toUpperCase() +
                              assignment.assignmentType.slice(1)}
                          </div>
                          <div
                            className={`text-xs ${getPriorityColor(
                              assignment.priority
                            )}`}
                          >
                            Priority: {assignment.priority}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            assignment.status
                          )}`}
                        >
                          {assignment.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(assignment.assignedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Doctors List View
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Doctor Management</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Doctors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Specialization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {doctors.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No doctors found
                  </td>
                </tr>
              ) : (
                doctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Dr. {doctor.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {doctor.id.slice(-8)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doctor.specialization || "General"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doctor.departmentName || "Not assigned"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{doctor.email}</div>
                        <div className="text-gray-500">
                          {doctor.phone || "No phone"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(doctor.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewDoctor(doctor)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Patients
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DoctorManagement;
