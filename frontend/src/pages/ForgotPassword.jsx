import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { hmsApi } from "../services/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await hmsApi.forgotPassword({ email });
      toast.success(res.message || "Password reset email sent!");
      setEmailSent(true);
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Check Your Email
            </h2>
            <p className="text-gray-600 mb-6">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              If you don't see the email, check your spam folder or try again.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Send Another Email
              </button>
              <Link
                to="/login"
                className="block w-full text-center text-blue-600 hover:text-blue-500"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* HospitalMS Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">HospitalMS</h1>
          <p className="text-gray-600">Hospital Management System</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-lg shadow-md"
        >
          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Forgot Password
            </h2>
            <p className="text-gray-600">
              Enter your email address and we'll send you a reset link
            </p>
          </div>

          {/* Email Input */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email address"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          {/* Back to Login */}
          <div className="text-center mt-4">
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
