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

    forgotPassword: async (req, res) => {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
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
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
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


};

module.exports = authController;
