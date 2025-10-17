const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

router.get('/ping', (req, res) => {
    res.status(200).json({ message: 'PING endpoint' });
});

// Auth Controller (Public routes)
router.post('/login', authController.login);
router.get('/logout', authenticate, authController.logout);


module.exports = router; 
