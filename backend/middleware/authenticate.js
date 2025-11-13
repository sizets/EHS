const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');

const authenticate = async (req, res, next) => {
    try {
        // Check for token in Authorization header only
        let token = req.headers.authorization;

        if (!token || !token.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'No token provided' });
        }

        token = token.slice(7); // Remove 'Bearer ' prefix

        const decoded = jwt.verify(token, 'randomsecretkey12345');
        const dbInstance = await connectDB();

        const user = await dbInstance.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
        if (!user) {
            return res.status(401).send({ error: 'User not found' });
        }

        req.user = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role || 'user',
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).send({ error: 'Token is not valid or expired' });
        }
        return res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = authenticate;
