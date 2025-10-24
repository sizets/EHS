import React, { useState, useEffect } from "react";
import { hmsApi } from "../services/api";

const PatientDoctorAssignment = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    patientId: "",
    doctorId: "",
    assignmentType: "emergency",
    priority: "normal",
    symptoms: "",
    notes: "",
    department: "",
  });

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [patientsRes, doctorsRes, departmentsRes] = await Promise.all([
        hmsApi.getUsersByRole("patient"),
        hmsApi.getAvailableDoctors(),
        hmsApi.getAllDepartments(),
      ]);

      setPatients(patientsRes.users || []);
      setDoctors(doctorsRes.doctors || []);
      setDepartments(departmentsRes.departments || []);
    } catch (err) {
      setError("Failed to load data: " + err.message);
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

    // Auto-set department when doctor is selected
    if (name === "doctorId") {
      const selectedDoctor = doctors.find((doctor) => doctor.id === value);
      if (selectedDoctor && selectedDoctor.departmentId) {
        setFormData((prev) => ({
          ...prev,
          department: selectedDoctor.departmentId,
        }));
      }
    }

    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate form
      if (!formData.patientId || !formData.doctorId) {
        throw new Error("Please fill in all required fields");
      }

      if (!formData.priority) {
        throw new Error("Priority is required for emergency assignments");
      }

      const assignmentData = {
        ...formData,
        priority: formData.priority,
      };

      const result = await hmsApi.createAssignment(assignmentData);

      setSuccess("Assignment created successfully!");

      // Call success callback after a short delay
      setTimeout(() => {
        if (onSuccess) onSuccess(result.assignment);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityOptions = () => {
    return [
      { value: "critical", label: "Critical" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
    ];
  };

  const selectedPatient = patients.find((p) => p.id === formData.patientId);
  const selectedDoctor = doctors.find((d) => d.id === formData.doctorId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Assign Doctor to Patient
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Patient *
              </label>
              <select
                name="patientId"
                value={formData.patientId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a patient...</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} ({patient.email})
                  </option>
                ))}
              </select>
              {selectedPatient && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  <p>
                    <strong>Patient Info:</strong>
                  </p>
                  <p>Email: {selectedPatient.email}</p>
                  <p>Phone: {selectedPatient.phone || "Not provided"}</p>
                  <p>Address: {selectedPatient.address || "Not provided"}</p>
                </div>
              )}
            </div>

            {/* Doctor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Doctor *
              </label>
              <select
                name="doctorId"
                value={formData.doctorId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a doctor...</option>
                {doctors.length === 0 ? (
                  <option value="" disabled>
                    No available emergency doctors
                  </option>
                ) : (
                  doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialization || "General"} (
                      {doctor.department || "No Department"})
                    </option>
                  ))
                )}
              </select>
              {selectedDoctor && (
                <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                  <p>
                    <strong>Doctor Info:</strong>
                  </p>
                  <p>
                    Specialization: {selectedDoctor.specialization || "General"}
                  </p>
                  <p>
                    Department: {selectedDoctor.department || "Not assigned"}
                  </p>
                  <p>Phone: {selectedDoctor.phone || "Not provided"}</p>
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Level *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                {getPriorityOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Department - Hidden field with department ID */}
            <input
              type="hidden"
              name="department"
              value={formData.department}
            />

            {/* Symptoms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symptoms/Complaints
              </label>
              <textarea
                name="symptoms"
                value={formData.symptoms}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe patient's symptoms or complaints..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes or instructions..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 rounded-md font-medium transition-colors bg-red-600 hover:bg-red-700 text-white ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Creating..." : "Create Emergency Assignment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PatientDoctorAssignment;
