import React, { useState, useEffect } from "react";
import { hmsApi } from "../services/api";

const CreateAppointmentModal = ({ onClose, onSuccess, currentPatientId }) => {
  const [formData, setFormData] = useState({
    patientId: currentPatientId || "",
    doctorId: "",
    appointmentDate: "",
    appointmentTime: "",
    symptoms: "",
    notes: "",
    department: "",
  });

  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load available doctors when date/time changes
  useEffect(() => {
    if (formData.appointmentDate && formData.appointmentTime) {
      loadAvailableDoctors();
    } else {
      // Load all doctors if no date/time selected
      loadInitialDoctors();
    }
  }, [formData.appointmentDate, formData.appointmentTime]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const departmentsRes = await hmsApi.getAllDepartments();
      setDepartments(departmentsRes.departments || []);
      await loadInitialDoctors();
    } catch (err) {
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const doctorsRes = await hmsApi.getAvailableDoctorsForAppointment();
      setDoctors(doctorsRes.doctors || []);
    } catch (err) {
      console.error("Failed to load doctors:", err);
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadAvailableDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const doctorsRes = await hmsApi.getAvailableDoctorsForAppointment(
        formData.appointmentDate,
        formData.appointmentTime
      );
      setDoctors(doctorsRes.doctors || []);
      
      // Clear doctor selection if selected doctor is no longer available
      if (formData.doctorId) {
        const isStillAvailable = doctorsRes.doctors?.some(
          (d) => d.id === formData.doctorId
        );
        if (!isStillAvailable) {
          setFormData((prev) => ({ ...prev, doctorId: "", department: "" }));
        }
      }
    } catch (err) {
      console.error("Failed to load available doctors:", err);
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
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
      if (!formData.patientId || !formData.doctorId || !formData.appointmentDate || !formData.appointmentTime) {
        throw new Error("Please fill in all required fields");
      }

      // Validate date is not in the past
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
      if (appointmentDateTime < new Date()) {
        throw new Error("Cannot book appointments in the past");
      }

      const appointmentData = {
        ...formData,
      };

      const result = await hmsApi.createAppointment(appointmentData);

      setSuccess("Appointment booked successfully!");

      // Call success callback after a short delay
      setTimeout(() => {
        if (onSuccess) onSuccess(result.appointment);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const selectedDoctor = doctors.find((d) => d.id === formData.doctorId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Book Appointment
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
            {/* Appointment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Date *
              </label>
              <input
                type="date"
                name="appointmentDate"
                value={formData.appointmentDate}
                onChange={handleInputChange}
                min={getMinDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Appointment Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Time *
              </label>
              <input
                type="time"
                name="appointmentTime"
                value={formData.appointmentTime}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Select date and time to see available doctors
              </p>
            </div>

            {/* Doctor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Doctor *
              </label>
              {loadingDoctors ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                  <span className="text-gray-500">Loading available doctors...</span>
                </div>
              ) : (
                <select
                  name="doctorId"
                  value={formData.doctorId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!formData.appointmentDate || !formData.appointmentTime}
                >
                  <option value="">
                    {!formData.appointmentDate || !formData.appointmentTime
                      ? "Please select date and time first"
                      : "Choose a doctor..."}
                  </option>
                  {doctors.length === 0 ? (
                    <option value="" disabled>
                      No available doctors at this time
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
              )}
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
                placeholder="Describe your symptoms or complaints..."
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
                placeholder="Any additional notes or information..."
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
                disabled={loading || loadingDoctors}
                className={`px-6 py-2 rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white ${
                  loading || loadingDoctors
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {loading ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAppointmentModal;

