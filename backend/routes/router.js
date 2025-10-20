const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/ping', (req, res) => {
    res.status(200).json({ message: 'PING endpoint' });
});

// Auth Controller (Public routes)
router.post('/register', authController.register);
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

module.exports = router; 
