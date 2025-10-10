const jwt = require('jsonwebtoken');
const connectDB = require('../mongo');

const googleAuthController = {
    // Initiate Google OAuth flow
    googleAuth: (req, res) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`;

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=profile email&` +
            `response_type=code&` +
            `access_type=offline&` +
            `prompt=consent`;

        res.redirect(authUrl);
    },

    // Handle Google OAuth callback
    googleCallback: async (req, res) => {
        try {
            const { code } = req.query;

            if (!code) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?error=no_code`);
            }

            // Exchange code for access token
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`,
                }),
            });

            const tokenData = await tokenResponse.json();

            if (!tokenData.access_token) {
                console.error('Token exchange failed:', tokenData);
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?error=token_failed`);
            }

            // Get user info from Google
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                },
            });

            const userData = await userResponse.json();

            if (!userData.email) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?error=no_email`);
            }

            const dbInstance = await connectDB();

            // Check if user exists
            let user = await dbInstance.collection('users').findOne({ email: userData.email.toLowerCase() });

            if (!user) {
                // Create new user with Google data
                const newUser = {
                    name: userData.name,
                    email: userData.email.toLowerCase(),
                    picture: userData.picture,
                    role: 'patient', // Default role
                    googleId: userData.id,
                    createdAt: new Date(),
                };

                const result = await dbInstance.collection('users').insertOne(newUser);
                user = { ...newUser, _id: result.insertedId };
            } else {
                // Update existing user with Google ID if not present
                if (!user.googleId) {
                    await dbInstance.collection('users').updateOne(
                        { _id: user._id },
                        { $set: { googleId: userData.id, picture: userData.picture } }
                    );
                }
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: user._id.toString(),
                    role: user.role || 'patient'
                },
                process.env.JWT_SECRET || 'randomsecretkey12345',
                { expiresIn: '24h' }
            );

            // Redirect to frontend callback page (handles popup communication)
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.redirect(`${frontendUrl}/auth-callback?token=${token}&role=${user.role || 'patient'}`);

        } catch (error) {
            console.error('Google OAuth error:', error);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-callback?error=oauth_failed`);
        }
    }
};

module.exports = googleAuthController;