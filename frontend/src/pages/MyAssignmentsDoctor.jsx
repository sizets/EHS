import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hmsApi } from "../services/api";
import { toast } from "react-toastify";

const MyAssignmentsDoctor = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const resp = await hmsApi.getMyAssignments();
      setAssignments(resp.assignments || []);
    } catch (err) {
      setError("Failed to load your assignments: " + err.message);
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (assignmentId, newStatus) => {
    if (!window.confirm(`Are you sure you want to mark this assignment as ${newStatus.replace("_", " ")}?`)) {
      return;
    }

    try {
      setUpdatingStatus(assignmentId);
      await hmsApi.updateMyAssignmentStatus(assignmentId, { status: newStatus });
      toast.success(`Assignment ${newStatus.replace("_", " ")} successfully`);
      
      // If completing an assignment, redirect to diagnosis page
      if (newStatus === "completed") {
        navigate(`/diagnosis/assignment/${assignmentId}`);
      } else {
        await loadAssignments();
      }
    } catch (err) {
      toast.error("Failed to update assignment status: " + err.message);
      setUpdatingStatus(null);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    return filterStatus === "all" || a.status === filterStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-600 font-semibold";
      case "medium":
        return "text-yellow-600 font-semibold";
      case "low":
        return "text-green-600 font-semibold";
      default:
        return "text-gray-600";
    }
  };

  const getTypeColor = (type) => {
    return type === "emergency"
      ? "text-red-600 font-semibold"
      : "text-green-600 font-semibold";
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
        <h1 className="text-3xl font-bold text-gray-800">My Assignments</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Total: {assignments.length}
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
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symptoms
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                    colSpan="8"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No assignments found
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {a.patientName || "Patient"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {a.department || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${getTypeColor(a.assignmentType)}`}>
                        {a.assignmentType?.toUpperCase() || "REGULAR"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${getPriorityColor(a.priority)}`}>
                        {a.priority?.toUpperCase() || "NORMAL"}
                      </span>
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
                        {a.status?.replace("_", " ")?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(a.assignedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {a.status === "assigned" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "in_progress")}
                              disabled={updatingStatus === a.id}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                            >
                              {updatingStatus === a.id ? "Updating..." : "Start"}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "cancelled")}
                              disabled={updatingStatus === a.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {a.status === "in_progress" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "completed")}
                              disabled={updatingStatus === a.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              {updatingStatus === a.id ? "Updating..." : "Complete"}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(a.id, "cancelled")}
                              disabled={updatingStatus === a.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {a.status === "completed" && (
                          <button
                            onClick={() => navigate(`/diagnosis/assignment/${a.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Diagnosis"
                          >
                            View Diagnosis
                          </button>
                        )}
                        {a.status === "cancelled" && (
                          <span className="text-gray-400">Cancelled</span>
                        )}
                        {(a.status === "assigned" || a.status === "in_progress") && (
                          <button
                            onClick={() => navigate(`/diagnosis/assignment/${a.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View / Add Diagnosis"
                          >
                            View / Diagnosis
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
    </div>
  );
};

export default MyAssignmentsDoctor;

