const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const departmentController = require('../controllers/departmentController');
const assignmentController = require('../controllers/assignmentController');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/ping', (req, res) => {
    res.status(200).json({ message: 'PING endpoint' });
});

// Auth Controller (Public routes)
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.post('/test-email', authController.testEmail);
router.post('/contact', authController.contact);
router.post('/subscribe', authController.subscribe);

// User Management Routes (Admin only)
router.get('/users', authenticate, requireAdmin, userController.getAllUsers);
router.get('/users/role/:role', authenticate, requireAdmin, userController.getUsersByRole);
router.get('/users/:id', authenticate, requireAdmin, userController.getUserById);
router.post('/users', authenticate, requireAdmin, userController.createUser);
router.put('/users/:id', authenticate, requireAdmin, userController.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, userController.deleteUser);

// Department Management Routes (Admin only)
router.get('/departments', authenticate, requireAdmin, departmentController.getAllDepartments);
router.get('/departments/:id', authenticate, requireAdmin, departmentController.getDepartmentById);
router.post('/departments', authenticate, requireAdmin, departmentController.createDepartment);
router.put('/departments/:id', authenticate, requireAdmin, departmentController.updateDepartment);
router.delete('/departments/:id', authenticate, requireAdmin, departmentController.deleteDepartment);

// Assignment Management Routes (Admin only)
router.get('/assignments', authenticate, requireAdmin, assignmentController.getAllAssignments);
router.get('/assignments/:id', authenticate, requireAdmin, assignmentController.getAssignmentById);
router.post('/assignments', authenticate, requireAdmin, assignmentController.createAssignment);
router.put('/assignments/:id/status', authenticate, requireAdmin, assignmentController.updateAssignmentStatus);
router.delete('/assignments/:id', authenticate, requireAdmin, assignmentController.deleteAssignment);
router.get('/assignments/patient/:patientId', authenticate, requireAdmin, assignmentController.getAssignmentsByPatient);
router.get('/assignments/doctor/:doctorId', authenticate, requireAdmin, assignmentController.getAssignmentsByDoctor);

module.exports = router; 
