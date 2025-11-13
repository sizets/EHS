import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hmsApi } from "../services/api";
import { toast } from "react-toastify";

const MyPatients = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("assignments"); // 'assignments' or 'appointments'

  useEffect(() => {
    loadMyAssignments();
    loadMyAppointments();
  }, []);

  const loadMyAssignments = async () => {
    try {
      const response = await hmsApi.getMyAssignments();
      setAssignments(response.assignments || []);
    } catch (err) {
      setError("Failed to load your assigned patients: " + err.message);
    }
  };

  const loadMyAppointments = async () => {
    try {
      const response = await hmsApi.getMyAppointmentsDoctor();
      setAppointments(response.appointments || []);
    } catch (err) {
      setError("Failed to load your appointments: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (assignmentId, newStatus) => {
    try {
      await hmsApi.updateMyAssignmentStatus(assignmentId, {
        status: newStatus,
      });
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? { ...a, status: newStatus, updatedAt: new Date().toISOString() }
            : a
        )
      );
      toast.success(`Assignment ${newStatus} successfully`);
    } catch (err) {
      setError("Failed to update assignment status: " + err.message);
      toast.error("Failed to update assignment status");
    }
  };

  const handleAppointmentStatusUpdate = async (appointmentId, newStatus) => {
    try {
      await hmsApi.updateAppointmentStatus(appointmentId, { status: newStatus });
      toast.success(`Appointment ${newStatus} successfully`);
      
      // If completing an appointment, redirect to diagnosis page
      if (newStatus === "completed") {
        navigate(`/diagnosis/appointment/${appointmentId}`);
      } else {
        await loadMyAppointments();
      }
    } catch (err) {
      toast.error("Failed to update appointment status: " + err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "assigned":
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
      case "confirmed":
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

  const filteredAssignments = assignments.filter((assignment) => {
    const statusMatch =
      filterStatus === "all" || assignment.status === filterStatus;
    return statusMatch;
  });

  const filteredAppointments = appointments.filter((appointment) => {
    const statusMatch =
      filterStatus === "all" || appointment.status === filterStatus;
    return statusMatch;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (timeString) => {
    if (!timeString) return "N/A";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatTimeRange = (startTime, endTime) => {
    if (!startTime) return "N/A";
    const start = formatTime(startTime);
    if (endTime) {
      const end = formatTime(endTime);
      return `${start} - ${end}`;
    }
    return start;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          My Patients
        </h1>
        <div className="text-sm text-gray-600">
          {activeTab === "assignments" 
            ? `Total: ${assignments.length} assignments`
            : `Total: ${appointments.length} appointments`}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-1 rounded-lg shadow mb-6 inline-flex">
        <button
          onClick={() => {
            setActiveTab("assignments");
            setFilterStatus("all");
          }}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            activeTab === "assignments"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Assignments ({assignments.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("appointments");
            setFilterStatus("all");
          }}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            activeTab === "appointments"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Appointments ({appointments.length})
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {activeTab === "assignments" ? (
                <>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </>
              ) : (
                <>
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      {activeTab === "assignments" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                    Symptoms
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No assigned patients found
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.patientName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {assignment.patientId.slice(-8)}
                        </div>
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
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {assignment.symptoms || "No symptoms recorded"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.department || "Not assigned"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(assignment.assignedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 flex-wrap">
                        {assignment.status === "assigned" && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(assignment.id, "in_progress")
                            }
                            className="text-yellow-600 hover:text-yellow-900 font-medium"
                          >
                            Start Treatment
                          </button>
                        )}
                        {assignment.status === "in_progress" && (
                          <>
                            <button
                              onClick={() =>
                                handleStatusUpdate(assignment.id, "completed")
                              }
                              className="text-green-600 hover:text-green-900 font-medium"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() =>
                                navigate(`/diagnosis/assignment/${assignment.id}`)
                              }
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Add Diagnosis
                            </button>
                          </>
                        )}
                        {(assignment.status === "assigned" ||
                          assignment.status === "in_progress") && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(assignment.id, "cancelled")
                            }
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Cancel
                          </button>
                        )}
                        {assignment.status === "completed" && (
                          <button
                            onClick={() =>
                              navigate(`/diagnosis/assignment/${assignment.id}`)
                            }
                            className="text-gray-700 hover:text-gray-900 font-medium"
                          >
                            View Diagnosis
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Appointments Table */}
      {activeTab === "appointments" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Slot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptoms
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No appointments found
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {appointment.patientName || "Unknown Patient"}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {appointment.patientId.slice(-8)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(appointment.appointmentDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimeRange(
                          appointment.startTime || appointment.appointmentTime,
                          appointment.endTime
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            appointment.status
                          )}`}
                        >
                          {appointment.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {appointment.symptoms || "No symptoms"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.department || "Not assigned"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2 flex-wrap">
                          {appointment.status === "scheduled" && (
                            <>
                              <button
                                onClick={() =>
                                  handleAppointmentStatusUpdate(
                                    appointment.id,
                                    "confirmed"
                                  )
                                }
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() =>
                                  handleAppointmentStatusUpdate(
                                    appointment.id,
                                    "cancelled"
                                  )
                                }
                                className="text-red-600 hover:text-red-900 font-medium"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {appointment.status === "confirmed" && (
                            <>
                              <button
                                onClick={() =>
                                  handleAppointmentStatusUpdate(
                                    appointment.id,
                                    "completed"
                                  )
                                }
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() =>
                                  navigate(
                                    `/diagnosis/appointment/${appointment.id}`
                                  )
                                }
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Add Diagnosis
                              </button>
                              <button
                                onClick={() =>
                                  handleAppointmentStatusUpdate(
                                    appointment.id,
                                    "cancelled"
                                  )
                                }
                                className="text-red-600 hover:text-red-900 font-medium"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {appointment.status === "completed" && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/diagnosis/appointment/${appointment.id}`
                                )
                              }
                              className="text-gray-700 hover:text-gray-900 font-medium"
                            >
                              View Diagnosis
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {activeTab === "assignments" ? (
          <>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">
                Total Assignments
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {assignments.length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">Active Cases</div>
              <div className="text-2xl font-bold text-yellow-600">
                {assignments.filter((a) => a.status === "in_progress").length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-green-600">
                {assignments.filter((a) => a.status === "completed").length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">
                Emergency Cases
              </div>
              <div className="text-2xl font-bold text-red-600">
                {assignments.filter((a) => a.assignmentType === "emergency").length}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">
                Total Appointments
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {appointments.length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">Scheduled</div>
              <div className="text-2xl font-bold text-blue-600">
                {appointments.filter((a) => a.status === "scheduled").length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">Confirmed</div>
              <div className="text-2xl font-bold text-yellow-600">
                {appointments.filter((a) => a.status === "confirmed").length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-green-600">
                {appointments.filter((a) => a.status === "completed").length}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MyPatients;
