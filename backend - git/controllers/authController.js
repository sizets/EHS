const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const connectDB = require('../mongo');

const JWT_SECRET = process.env.JWT_SECRET || 'randomsecretkey12345'; // Use environment variable

// Initialize Courier client
let courier = null;
try {
    const { CourierClient } = require('@trycourier/courier');
    if (process.env.COURIER_AUTH_TOKEN) {
        courier = new CourierClient({
            authorizationToken: process.env.COURIER_AUTH_TOKEN
        });
        console.log('✅ Courier email service initialized successfully');
    } else {
        console.log('⚠️ Courier auth token not found in environment variables');
    }
} catch (error) {
    console.log('❌ Courier email service not available:', error.message);
}

const authController = {


    login: async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        try {
            const dbInstance = await connectDB();
            const user = await dbInstance.collection('users').findOne({ email: email.trim().toLowerCase() });

            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '24h' });

            return res.status(200).json({
                message: 'Login successful',
                token,
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role || 'patient'
                }
            });

        } catch (error) {
            console.error('Login Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    logout: (req, res) => {
        return res.status(200).json({ message: 'Logged out successfully' });
    },


};

module.exports = authController;
