import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hmsApi } from "../services/api";
import CreateAppointmentModal from "../components/CreateAppointmentModal";

const MyAppointments = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [currentPatientId, setCurrentPatientId] = useState(null);

  useEffect(() => {
    loadPatientInfo();
    loadAppointments();
  }, []);

  const loadPatientInfo = async () => {
    try {
      const profile = await hmsApi.getProfile();
      if (profile.user && profile.user.role === "patient") {
        setCurrentPatientId(profile.user.id);
      }
    } catch (err) {
      console.error("Failed to load patient info:", err);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const resp = await hmsApi.getMyAppointments();
      setAppointments(resp.appointments || []);
    } catch (err) {
      setError("Failed to load your appointments: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = () => {
    setShowAppointmentModal(true);
  };

  const handleAppointmentSuccess = async (newAppointment) => {
    setShowAppointmentModal(false);
    await loadAppointments();
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }

    try {
      await hmsApi.updateAppointmentStatus(appointmentId, { status: "cancelled" });
      await loadAppointments();
    } catch (err) {
      setError("Failed to cancel appointment: " + err.message);
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
    // Format time string (HH:MM) to readable format
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

  const formatDateTime = (dateString, timeString) => {
    if (!dateString || !timeString) return "N/A";
    const date = new Date(`${dateString}T${timeString}`);
    return date.toLocaleString();
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
        <h1 className="text-3xl font-bold text-gray-800">My Appointments</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Total: {appointments.length}
          </div>
          <button
            onClick={handleCreateAppointment}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Book New Appointment
          </button>
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
                    colSpan="6"
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
                        {a.doctorName || "Doctor"}
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
                        {a.status === "scheduled" || a.status === "confirmed" ? (
                          <button
                            onClick={() => handleCancelAppointment(a.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Cancel
                          </button>
                        ) : null}
                        {a.status === "completed" && (
                          <button
                            onClick={() => navigate(`/diagnosis/appointment/${a.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
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

      {/* Create Appointment Modal */}
      {showAppointmentModal && (
        <CreateAppointmentModal
          onClose={() => setShowAppointmentModal(false)}
          onSuccess={handleAppointmentSuccess}
          currentPatientId={currentPatientId}
        />
      )}
    </div>
  );
};

export default MyAppointments;

