import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { hmsApi } from "../services/api";
import ConfirmModal from "../components/ConfirmModal";

const Diagnosis = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [diagnosisToDelete, setDiagnosisToDelete] = useState(null);
  const [formData, setFormData] = useState({
    diagnosisName: "",
    description: "",
  });
  const userRole = localStorage.getItem("role");

  useEffect(() => {
    if (assignmentId) {
      loadDiagnosisData();
    }
  }, [assignmentId]);

  const loadDiagnosisData = async () => {
    try {
      setLoading(true);
      const response = await hmsApi.getDiagnosesByAssignment(assignmentId);
      setDiagnoses(response.diagnoses || []);
      setAssignment(response.assignment || null);
    } catch (err) {
      setError("Failed to load diagnosis data: " + err.message);
      toast.error("Failed to load diagnosis data");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.diagnosisName.trim()) {
      toast.error("Diagnosis name is required");
      return;
    }
    try {
      await hmsApi.createDiagnosis({
        assignmentId,
        diagnosisName: formData.diagnosisName,
        description: formData.description,
      });
      toast.success("Diagnosis created successfully");
      setShowCreateModal(false);
      setFormData({ diagnosisName: "", description: "" });
      loadDiagnosisData();
    } catch (err) {
      toast.error(err.message || "Failed to create diagnosis");
    }
  };

  const handleEditClick = (diagnosis) => {
    setSelectedDiagnosis(diagnosis);
    setFormData({
      diagnosisName: diagnosis.diagnosisName,
      description: diagnosis.description || "",
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.diagnosisName.trim()) {
      toast.error("Diagnosis name is required");
      return;
    }
    try {
      await hmsApi.updateDiagnosis(selectedDiagnosis.id, {
        diagnosisName: formData.diagnosisName,
        description: formData.description,
      });
      toast.success("Diagnosis updated successfully");
      setShowEditModal(false);
      setSelectedDiagnosis(null);
      setFormData({ diagnosisName: "", description: "" });
      loadDiagnosisData();
    } catch (err) {
      toast.error(err.message || "Failed to update diagnosis");
    }
  };

  const handleDelete = (diagnosisId) => {
    setDiagnosisToDelete(diagnosisId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!diagnosisToDelete) return;
    try {
      await hmsApi.deleteDiagnosis(diagnosisToDelete);
      toast.success("Diagnosis deleted successfully");
      setShowDeleteModal(false);
      setDiagnosisToDelete(null);
      loadDiagnosisData();
    } catch (err) {
      toast.error(err.message || "Failed to delete diagnosis");
    }
  };

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

  if (error && !assignment) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate("/assignments")}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Back to Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() =>
              navigate(
                userRole === "patient" ? "/my-assignments" : "/assignments"
              )
            }
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
          >
            ← Back to Assignments
          </button>
          <h1 className="text-3xl font-bold text-gray-800">
            Diagnosis Management
          </h1>
          {assignment && (
            <p className="text-gray-600 mt-2">
              Assignment ID: {assignment.id?.slice(-8)} | Status:{" "}
              <span className="font-semibold">{assignment.status}</span>
            </p>
          )}
        </div>
        {assignment?.status === "in_progress" && userRole !== "patient" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Add Diagnosis
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Diagnoses List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {diagnoses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">
              No diagnoses found for this assignment
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diagnosis Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diagnosed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {diagnoses.map((diagnosis) => (
                  <tr key={diagnosis.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {diagnosis.diagnosisName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-md truncate">
                        {diagnosis.description || "No description"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {diagnosis.diagnosedByName || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(diagnosis.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {userRole !== "patient" && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditClick(diagnosis)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(diagnosis.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Diagnosis Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Add Diagnosis
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ diagnosisName: "", description: "" });
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diagnosis Name *
                    </label>
                    <input
                      type="text"
                      name="diagnosisName"
                      value={formData.diagnosisName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Acute bronchitis"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Additional details about the diagnosis..."
                    />
                  </div>
                </div>
                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Create Diagnosis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ diagnosisName: "", description: "" });
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Diagnosis Modal */}
      {showEditModal && selectedDiagnosis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Edit Diagnosis
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedDiagnosis(null);
                    setFormData({ diagnosisName: "", description: "" });
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diagnosis Name *
                    </label>
                    <input
                      type="text"
                      name="diagnosisName"
                      value={formData.diagnosisName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Acute bronchitis"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Additional details about the diagnosis..."
                    />
                  </div>
                </div>
                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Update Diagnosis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedDiagnosis(null);
                      setFormData({ diagnosisName: "", description: "" });
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDiagnosisToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete diagnosis?"
        message="This action cannot be undone. The diagnosis will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default Diagnosis;
