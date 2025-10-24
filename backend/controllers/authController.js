const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
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

// Validation helper functions
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return { isValid: false, message: 'Password must be at least 6 characters long' };
    }
    return { isValid: true };
};

const authController = {
    login: async (req, res) => {
        // Check if req.body exists
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
        }

        const { email, password } = req.body;

        // Enhanced validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!validateEmail(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ error: passwordValidation.message });
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

    getProfile: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const user = await dbInstance.collection('users').findOne({ _id: new ObjectId(req.user.id) });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get department name if user has a department
            let departmentName = null;
            if (user.department) {
                const department = await dbInstance.collection('departments').findOne({
                    _id: user.department
                });
                departmentName = department ? department.name : null;
            }

            // Remove sensitive data and format response
            const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
            safeUser.id = user._id.toString();
            delete safeUser._id;

            // Add department name to response
            if (departmentName) {
                safeUser.departmentName = departmentName;
            }

            return res.status(200).json({
                user: safeUser
            });
        } catch (error) {
            console.error('Profile Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    contact: async (req, res) => {
        // Check if req.body exists
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
        }

        const { name, email, message, subject } = req.body;

        if (!name || !email || !message || !subject) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!validateEmail(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        if (name.trim().length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters long' });
        }

        if (message.trim().length < 10) {
            return res.status(400).json({ error: 'Message must be at least 10 characters long' });
        }

        try {
            const dbInstance = await connectDB();
            await dbInstance.collection('contact').insertOne({
                name,
                email,
                message,
                subject,
                createdAt: new Date()
            });
            return res.status(200).json({ message: 'Contact form submitted' });
        } catch (error) {
            console.error('Contact Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    subscribe: async (req, res) => {
        // Check if req.body exists
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
        }

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!validateEmail(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        try {
            const dbInstance = await connectDB();
            await dbInstance.collection('subscribers').insertOne({
                email,
                createdAt: new Date()
            });
            return res.status(200).json({ message: 'Subscribed successfully' });
        } catch (error) {
            console.error('Subscribe Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    forgotPassword: async (req, res) => {
        // Check if req.body exists
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
        }

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        if (!validateEmail(email.trim())) {
            return res.status(400).json({ error: 'Please provide a valid email address' });
        }

        try {
            const dbInstance = await connectDB();
            const user = await dbInstance.collection('users').findOne({ email: email.trim().toLowerCase() });

            if (!user) {
                // For security, don't reveal if user exists or not
                return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

            // Store reset token in database
            await dbInstance.collection('users').updateOne(
                { email: email.trim().toLowerCase() },
                {
                    $set: {
                        resetToken: resetToken,
                        resetTokenExpiry: resetTokenExpiry
                    }
                }
            );

            // Email content
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

            // Send email using Courier
            if (courier && process.env.COURIER_AUTH_TOKEN) {
                try {
                    const { requestId } = await courier.send({
                        message: {
                            to: {
                                email: email,
                            },
                            template: process.env.COURIER_TEMPLATE_ID || "password-reset",
                            data: {
                                resetUrl: resetUrl,
                                userName: user.name || 'User',
                                expiryTime: '1 hour',
                                hospitalName: 'HospitalMS'
                            },
                        },
                    });
                    console.log('✅ Password reset email sent via Courier:', requestId);
                } catch (courierError) {
                    console.error('❌ Courier email send failed:', courierError);
                    // Log the reset URL for development
                    if (process.env.NODE_ENV === 'development') {
                        console.log('🔗 Password reset URL (development):', resetUrl);
                    }
                }
            } else {
                console.warn('⚠️ Courier not configured. Skipping email send.');
                // In development, log the reset URL
                if (process.env.NODE_ENV === 'development') {
                    console.log('🔗 Password reset URL (development):', resetUrl);
                }
            }

            return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

        } catch (error) {
            console.error('Forgot Password Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    resetPassword: async (req, res) => {
        // Check if req.body exists
        if (!req.body) {
            return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
        }

        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        try {
            const dbInstance = await connectDB();

            // Find user with valid reset token
            const user = await dbInstance.collection('users').findOne({
                resetToken: token,
                resetTokenExpiry: { $gt: new Date() }
            });

            if (!user) {
                return res.status(400).json({ error: 'Invalid or expired reset token' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password and clear reset token
            await dbInstance.collection('users').updateOne(
                { _id: user._id },
                {
                    $set: { password: hashedPassword },
                    $unset: { resetToken: "", resetTokenExpiry: "" }
                }
            );

            return res.status(200).json({ message: 'Password reset successful' });

        } catch (error) {
            console.error('Reset Password Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Send account creation email
    // Email template variables available:
    // - {userName}: User's full name
    // - {email}: User's email address  
    // - {pass}: User's password (plain text)
    // - {activationUrl}: URL to login page
    // - {role}: User's role (Patient, Doctor, Admin)
    // - {hospitalName}: Hospital name (HospitalMS)
    sendAccountCreationEmail: async (userData) => {
        const { name, email, password, role } = userData;

        if (!courier || !process.env.COURIER_AUTH_TOKEN) {
            console.warn('⚠️ Courier not configured. Skipping account creation email.');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            // Generate activation URL (you can customize this based on your needs)
            const activationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

            const { requestId } = await courier.send({
                message: {
                    to: {
                        email: email,
                    },
                    template: process.env.COURIER_ACCOUNT_CREATION_TEMPLATE_ID || "account-creation",
                    data: {
                        userName: name,
                        email: email,
                        pass: password,
                        activationUrl: activationUrl,
                        role: role.charAt(0).toUpperCase() + role.slice(1),
                        hospitalName: 'HospitalMS'
                    },
                },
            });

            console.log('✅ Account creation email sent via Courier:', requestId);
            return { success: true, requestId };

        } catch (error) {
            console.error('❌ Account creation email send failed:', error);
            return { success: false, error: error.message };
        }
    },


};

module.exports = authController;
