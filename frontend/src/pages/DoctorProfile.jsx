import React, { useState, useEffect } from "react";
import { hmsApi } from "../services/api";

const DoctorProfile = () => {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    specialization: "",
    department: "",
    departmentName: "",
  });

  const [schedule, setSchedule] = useState({
    monday: { available: false, startTime: "09:00", endTime: "17:00" },
    tuesday: { available: false, startTime: "09:00", endTime: "17:00" },
    wednesday: { available: false, startTime: "09:00", endTime: "17:00" },
    thursday: { available: false, startTime: "09:00", endTime: "17:00" },
    friday: { available: false, startTime: "09:00", endTime: "17:00" },
    saturday: { available: false, startTime: "09:00", endTime: "17:00" },
    sunday: { available: false, startTime: "09:00", endTime: "17:00" },
  });

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [profileRes, departmentsRes] = await Promise.all([
        hmsApi.getProfile(),
        hmsApi.getAllDepartments(),
      ]);

      setProfile(profileRes.user || {});
      setDepartments(departmentsRes.departments || []);

      // Load schedule if it exists
      if (profileRes.user?.schedule) {
        setSchedule(profileRes.user.schedule);
      }
    } catch (err) {
      setError("Failed to load profile data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError("");
  };

  const handleScheduleChange = (day, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: field === "available" ? value : value,
      },
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updateData = {
        ...profile,
        schedule: schedule,
      };

      await hmsApi.updateProfile(updateData);
      setSuccess("Profile updated successfully!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to update profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getDayName = (day) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-gray-600">
          Manage your personal information and availability schedule
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Personal Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={profile.name || ""}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={profile.email || ""}
                onChange={handleProfileChange}
                readOnly
                title="Email cannot be changed"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={profile.phone || ""}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={profile.address || ""}
                onChange={handleProfileChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialization
              </label>
              <input
                type="text"
                name="specialization"
                value={profile.specialization || ""}
                onChange={handleProfileChange}
                placeholder="e.g., Cardiology, Neurology, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                name="department"
                value={profile.department || ""}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Availability Schedule
          </h2>

          <div className="space-y-4">
            {Object.keys(schedule).map((day) => (
              <div key={day} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700">
                    {getDayName(day)}
                  </h3>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={schedule[day].available}
                      onChange={(e) =>
                        handleScheduleChange(day, "available", e.target.checked)
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-600">Available</span>
                  </label>
                </div>

                {schedule[day].available && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={schedule[day].startTime}
                        onChange={(e) =>
                          handleScheduleChange(day, "startTime", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={schedule[day].endTime}
                        onChange={(e) =>
                          handleScheduleChange(day, "endTime", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className={`px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors ${
            saving ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default DoctorProfile;
