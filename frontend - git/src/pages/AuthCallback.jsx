import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const role = searchParams.get("role");
    const error = searchParams.get("error");

    if (window.opener) {
      // Send message to parent window
      if (error) {
        window.opener.postMessage(
          {
            type: "GOOGLE_AUTH_ERROR",
            error: error,
          },
          window.location.origin
        );
      } else if (token && role) {
        window.opener.postMessage(
          {
            type: "GOOGLE_AUTH_SUCCESS",
            token: token,
            role: role,
          },
          window.location.origin
        );
      }

      // Close popup after sending message
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      // Fallback if not in popup (direct navigation)
      if (token && role) {
        localStorage.setItem("token", token);
        localStorage.setItem("role", role);
        window.location.href = "/dashboard";
      } else if (error) {
        window.location.href = `/login?error=${error}`;
      }
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

