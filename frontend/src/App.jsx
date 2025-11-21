import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import UserManagement from "./pages/UserManagement";
import DepartmentManagement from "./pages/DepartmentManagement";
import AssignmentManagement from "./pages/AssignmentManagement";
import DoctorManagement from "./pages/DoctorManagement";
import MyPatients from "./pages/MyPatients";
import DoctorProfile from "./pages/DoctorProfile";
import Diagnosis from "./pages/Diagnosis";
import MyAssignments from "./pages/MyAssignments.jsx";
import MyAssignmentsDoctor from "./pages/MyAssignmentsDoctor.jsx";
import MyAppointments from "./pages/MyAppointments.jsx";
import MyAppointmentsDoctor from "./pages/MyAppointmentsDoctor.jsx";
import AppointmentManagement from "./pages/AppointmentManagement.jsx";
import MyBills from "./pages/MyBills.jsx";

const App = () => {
  return (
    <Layout>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments"
          element={
            <ProtectedRoute requiredRole="admin">
              <DepartmentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments"
          element={
            <ProtectedRoute requiredRole="admin">
              <AssignmentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctors"
          element={
            <ProtectedRoute requiredRole="admin">
              <DoctorManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments"
          element={
            <ProtectedRoute requiredRole="admin">
              <AppointmentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-patients"
          element={
            <ProtectedRoute requiredRole="doctor">
              <MyPatients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRole="doctor">
              <DoctorProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/diagnosis/assignment/:assignmentId"
          element={
            <ProtectedRoute requiredRole={["doctor", "admin", "patient"]}>
              <Diagnosis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/diagnosis/appointment/:appointmentId"
          element={
            <ProtectedRoute requiredRole={["doctor", "admin", "patient"]}>
              <Diagnosis />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-assignments"
          element={
            <ProtectedRoute requiredRole="patient">
              <MyAssignments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-appointments"
          element={
            <ProtectedRoute requiredRole="patient">
              <MyAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bills"
          element={
            <ProtectedRoute requiredRole="patient">
              <MyBills />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-appointments-doctor"
          element={
            <ProtectedRoute requiredRole="doctor">
              <MyAppointmentsDoctor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-assignments-doctor"
          element={
            <ProtectedRoute requiredRole="doctor">
              <MyAssignmentsDoctor />
            </ProtectedRoute>
          }
        />

        {/* Home Route - Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Layout>
  );
};

export default App;
