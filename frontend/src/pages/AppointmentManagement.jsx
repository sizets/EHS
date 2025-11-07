import React, { useState, useEffect } from "react";
import { hmsApi } from "../services/api";
import { toast } from "react-toastify";
import ConfirmModal from "../components/ConfirmModal";

const AppointmentManagement = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await hmsApi.getAllAppointments();
      setAppointments(response.appointments || []);
    } catch (err) {
      setError("Failed to load appointments: " + err.message);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    if (!window.confirm(`Are you sure you want to mark this appointment as ${newStatus}?`)) {
      return;
    }

    try {
      setUpdatingStatus(appointmentId);
      await hmsApi.updateAppointmentStatus(appointmentId, { status: newStatus });
      toast.success(`Appointment ${newStatus} successfully`);
      await loadAppointments();
    } catch (err) {
      toast.error("Failed to update appointment status: " + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteClick = (appointment) => {
    setAppointmentToDelete(appointment);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!appointmentToDelete) return;

    try {
      await hmsApi.deleteAppointment(appointmentToDelete.id);
      toast.success("Appointment deleted successfully");
      setAppointments((prev) =>
        prev.filter((a) => a.id !== appointmentToDelete.id)
      );
      setShowDeleteModal(false);
      setAppointmentToDelete(null);
    } catch (err) {
      toast.error("Failed to delete appointment: " + err.message);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    return filterStatus === "all" || a.status === filterStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
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

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
        <h1 className="text-3xl font-bold text-gray-800">Appointment Management</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Total: {appointments.length}
          </div>
        </div>
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
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Slot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symptoms
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                    colSpan="8"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No appointments found
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {a.patientName || "Unknown Patient"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {a.doctorName || "Unknown Doctor"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {a.department || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(a.appointmentDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTimeRange(a.startTime || a.appointmentTime, a.endTime)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {a.symptoms || "No symptoms"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          a.status
                        )}`}
                      >
                        {a.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {a.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "confirmed")}
                              disabled={updatingStatus === a.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Confirm"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "cancelled")}
                              disabled={updatingStatus === a.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {a.status === "confirmed" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "completed")}
                              disabled={updatingStatus === a.id}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                              title="Complete"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "cancelled")}
                              disabled={updatingStatus === a.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteClick(a)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAppointmentToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Appointment?"
        message="This action cannot be undone. The appointment will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default AppointmentManagement;

