const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

router.get('/ping', (req, res) => {
    res.status(200).json({ message: 'PING endpoint' });
});

// Auth Controller (Public routes)
// use this routes for everything related to authentication
router.post('/login', authController.login);
router.get('/logout', authenticate, authController.logout);

// User Management Routes (Admin only)
router.get('/users', authenticate, requireAdmin, userController.getAllUsers);
router.get('/users/role/:role', authenticate, requireAdmin, userController.getUsersByRole);
router.get('/users/:id', authenticate, requireAdmin, userController.getUserById);
router.post('/users', authenticate, requireAdmin, userController.createUser);
router.put('/users/:id', authenticate, requireAdmin, userController.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, userController.deleteUser);

module.exports = router; 
