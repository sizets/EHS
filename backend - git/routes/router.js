const express = require('express');
const router = express.Router();
const googleAuthController = require('../controllers/googleAuthController');

// Google OAuth routes
router.get('/auth/google', googleAuthController.googleAuth);
router.get('/auth/google/callback', googleAuthController.googleCallback);

// Basic ping endpoint
router.get('/ping', (req, res) => {
    res.status(200).json({ message: 'PING endpoint' });
});

module.exports = router;
