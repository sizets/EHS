import React, { useState, useEffect } from "react";
import { hmsApi } from "../services/api";
import PatientDoctorAssignment from "../components/PatientDoctorAssignment";
import ConfirmModal from "../components/ConfirmModal";

const AssignmentManagement = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const response = await hmsApi.getAllAssignments();
      setAssignments(response.assignments || []);
    } catch (err) {
      setError("Failed to load assignments: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = () => {
    setShowAssignmentModal(true);
  };

  const handleAssignmentSuccess = (newAssignment) => {
    setAssignments((prev) => [newAssignment, ...prev]);
    setShowAssignmentModal(false);
  };

  const handleDeleteClick = (assignment) => {
    setSelectedAssignment(assignment);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAssignment) return;

    try {
      await hmsApi.deleteAssignment(selectedAssignment.id);
      setAssignments((prev) =>
        prev.filter((a) => a.id !== selectedAssignment.id)
      );
      setShowDeleteModal(false);
      setSelectedAssignment(null);
    } catch (err) {
      setError("Failed to delete assignment: " + err.message);
    }
  };

  const handleStatusUpdate = async (assignmentId, newStatus) => {
    try {
      await hmsApi.updateAssignmentStatus(assignmentId, { status: newStatus });
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? { ...a, status: newStatus, updatedAt: new Date().toISOString() }
            : a
        )
      );
    } catch (err) {
      setError("Failed to update assignment status: " + err.message);
    }
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

  const filteredAssignments = assignments.filter((assignment) => {
    const statusMatch =
      filterStatus === "all" || assignment.status === filterStatus;
    return statusMatch;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
          Assignment Management
        </h1>
        <button
          onClick={handleCreateAssignment}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Assignment
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
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type & Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                    No assignments found
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
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.doctorName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {assignment.doctorId.slice(-8)}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.department || "Not assigned"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(assignment.assignedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {assignment.status === "assigned" && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(assignment.id, "in_progress")
                            }
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Start
                          </button>
                        )}
                        {assignment.status === "in_progress" && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(assignment.id, "completed")
                            }
                            className="text-green-600 hover:text-green-900"
                          >
                            Complete
                          </button>
                        )}
                        {(assignment.status === "assigned" ||
                          assignment.status === "in_progress") && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(assignment.id, "cancelled")
                            }
                            className="text-red-600 hover:text-red-900"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(assignment)}
                          className="text-red-600 hover:text-red-900"
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

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <PatientDoctorAssignment
          onClose={() => setShowAssignmentModal(false)}
          onSuccess={handleAssignmentSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedAssignment(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Assignment"
          message={`Are you sure you want to delete the assignment between ${selectedAssignment?.patientName} and ${selectedAssignment?.doctorName}?`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
};

export default AssignmentManagement;
