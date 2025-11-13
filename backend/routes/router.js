const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const departmentController = require('../controllers/departmentController');
const assignmentController = require('../controllers/assignmentController');
const appointmentController = require('../controllers/appointmentController');
const diagnosisController = require('../controllers/diagnosisController');
const testController = require('../controllers/testController');
const billingController = require('../controllers/billingController');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

// Auth Controller (Public routes)
router.post('/login', authController.login);
router.post('/register', authController.registerPatient);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.post('/contact', authController.contact);
router.post('/subscribe', authController.subscribe);

// User Management Routes (Admin only)
router.get('/users', authenticate, requireAdmin, userController.getAllUsers);
router.get('/users/role/:role', authenticate, requireAdmin, userController.getUsersByRole);
router.get('/users/pending', authenticate, requireAdmin, userController.getPendingPatients);
router.get('/users/:id', authenticate, requireAdmin, userController.getUserById);
router.post('/users', authenticate, requireAdmin, userController.createUser);
router.put('/users/:id', authenticate, requireAdmin, userController.updateUser);
router.put('/users/:id/approve', authenticate, requireAdmin, userController.approvePatient);
router.delete('/users/:id', authenticate, requireAdmin, userController.deleteUser);

// Department Management Routes (Admin only)
router.get('/departments', authenticate, departmentController.getAllDepartments);
router.get('/departments/:id', authenticate, requireAdmin, departmentController.getDepartmentById);
router.post('/departments', authenticate, requireAdmin, departmentController.createDepartment);
router.put('/departments/:id', authenticate, requireAdmin, departmentController.updateDepartment);
router.delete('/departments/:id', authenticate, requireAdmin, departmentController.deleteDepartment);

// Assignment Management Routes (Admin only)
router.get('/assignments', authenticate, requireAdmin, assignmentController.getAllAssignments);
router.get('/assignments/available-doctors', authenticate, requireAdmin, assignmentController.getAvailableDoctors);
router.get('/assignments/patient/:patientId', authenticate, requireAdmin, assignmentController.getAssignmentsByPatient);
router.get('/assignments/doctor/:doctorId', authenticate, requireAdmin, assignmentController.getAssignmentsByDoctor);
router.get('/assignments/:id', authenticate, requireAdmin, assignmentController.getAssignmentById);
router.post('/assignments', authenticate, requireAdmin, assignmentController.createAssignment);
router.put('/assignments/:id/status', authenticate, requireAdmin, assignmentController.updateAssignmentStatus);
router.delete('/assignments/:id', authenticate, requireAdmin, assignmentController.deleteAssignment);

// Doctor-specific routes
router.get('/my-assignments', authenticate, assignmentController.getMyAssignments);
router.put('/my-assignments/:id/status', authenticate, assignmentController.updateMyAssignmentStatus);

// Patient-specific routes
router.get('/my-assignments-patient', authenticate, assignmentController.getMyAssignmentsPatient);

// Appointment Management Routes
router.get('/appointments', authenticate, requireAdmin, appointmentController.getAllAppointments);
router.get('/appointments/available-doctors', authenticate, appointmentController.getAvailableDoctors);
router.get('/appointments/available-slots', authenticate, appointmentController.getAvailableTimeSlots);
router.get('/appointments/patient/:patientId', authenticate, requireAdmin, appointmentController.getAppointmentsByPatient);
router.get('/appointments/doctor/:doctorId', authenticate, requireAdmin, appointmentController.getAppointmentsByDoctor);
router.get('/appointments/:id', authenticate, appointmentController.getAppointmentById);
router.post('/appointments', authenticate, appointmentController.createAppointment);
router.put('/appointments/:id/status', authenticate, appointmentController.updateAppointmentStatus);
router.delete('/appointments/:id', authenticate, appointmentController.deleteAppointment);

// Patient-specific appointment routes
router.get('/my-appointments', authenticate, appointmentController.getMyAppointments);

// Doctor-specific appointment routes
router.get('/my-appointments-doctor', authenticate, appointmentController.getMyAppointmentsDoctor);

// Diagnosis Management Routes (Doctor and Admin)
router.get('/diagnoses', authenticate, diagnosisController.getAllDiagnoses);
router.get('/diagnoses/assignment/:assignmentId', authenticate, diagnosisController.getDiagnosesByAssignment);
router.get('/diagnoses/appointment/:appointmentId', authenticate, diagnosisController.getDiagnosesByAppointment);
router.get('/diagnoses/:id', authenticate, diagnosisController.getDiagnosisById);
router.post('/diagnoses', authenticate, diagnosisController.createDiagnosis);
router.put('/diagnoses/:id', authenticate, diagnosisController.updateDiagnosis);
router.delete('/diagnoses/:id', authenticate, diagnosisController.deleteDiagnosis);

// Test Management Routes (Doctor and Admin)
router.get('/tests', authenticate, testController.getAllTests);
router.get('/tests/patient/:patientId', authenticate, testController.getTestsByPatient);
router.get('/tests/:id', authenticate, testController.getTestById);
router.post('/tests', authenticate, testController.createTest);
router.put('/tests/:id', authenticate, testController.updateTest);
router.delete('/tests/:id', authenticate, testController.deleteTest);

// Billing/Charges Management Routes
router.get('/charges', authenticate, requireAdmin, billingController.getAllCharges);
router.get('/charges/patient/:patientId', authenticate, billingController.getChargesByPatient);
router.get('/charges/assignment/:assignmentId', authenticate, billingController.getChargesByAssignment);
router.post('/charges', authenticate, requireAdmin, billingController.createCharge);
router.put('/charges/:id/status', authenticate, requireAdmin, billingController.updateChargeStatus);
router.delete('/charges/:id', authenticate, requireAdmin, billingController.deleteCharge);

// Profile management routes
router.put('/profile', authenticate, userController.updateProfile);

module.exports = router; 
