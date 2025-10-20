import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { hmsApi } from "../services/api";
import CreateDepartmentModal from "../components/CreateDepartmentModal";
import EditDepartmentModal from "../components/EditDepartmentModal";
import ConfirmModal from "../components/ConfirmModal";

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await hmsApi.getAllDepartments();
      setDepartments(response.departments || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Failed to fetch departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchDepartments();
    toast.success("Department created successfully!");
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedDepartment(null);
    fetchDepartments();
    toast.success("Department updated successfully!");
  };

  const handleDelete = (department) => {
    setDepartmentToDelete(department);
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!departmentToDelete) return;

    try {
      await hmsApi.deleteDepartment(departmentToDelete.id);
      fetchDepartments();
      toast.success("Department deleted successfully!");
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error(error.message || "Failed to delete department");
    } finally {
      setShowConfirmModal(false);
      setDepartmentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
    setDepartmentToDelete(null);
  };

  const handleEdit = (department) => {
    setSelectedDepartment(department);
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Department Management
          </h1>
          <p className="text-gray-600">Manage hospital departments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>Add Department</span>
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No departments
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new department.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Add Department
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {departments.map((department) => (
              <li key={department.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-600 truncate">
                        {department.name}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <button
                          onClick={() => handleEdit(department)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(department)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {department.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {department.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Created:{" "}
                      {new Date(department.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCreateModal && (
        <CreateDepartmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showEditModal && selectedDepartment && (
        <EditDepartmentModal
          department={selectedDepartment}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {showConfirmModal && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title="Delete Department"
          message={`Are you sure you want to delete "${departmentToDelete?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
};

export default DepartmentManagement;
