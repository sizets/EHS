const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');

const userController = {
    // Get all users (Admin only)
    getAllUsers: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const users = await dbInstance.collection('users').find({}).toArray();
            
            // Remove passwords from response
            const safeUsers = users.map(user => {
                const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
                return safeUser;
            });

            res.json({ users: safeUsers });
        } catch (error) {
            console.error('Get all users error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get user by ID
    getUserById: async (req, res) => {
        try {
            const { id } = req.params;
            const dbInstance = await connectDB();
            
            const user = await dbInstance.collection('users').findOne({ _id: new ObjectId(id) });
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Remove sensitive data
            const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
            res.json({ user: safeUser });
        } catch (error) {
            console.error('Get user by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create new user (Admin only)
    createUser: async (req, res) => {
        try {
            const { name, email, password, role } = req.body;

            // Validation
            if (!name || !email || !password || !role) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            // Validate role
            const validRoles = ['patient', 'doctor', 'admin'];
            if (!validRoles.includes(role.toLowerCase())) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const dbInstance = await connectDB();
            
            // Check if user already exists
            const existingUser = await dbInstance.collection('users').findOne({ 
                email: email.trim().toLowerCase() 
            });
            
            if (existingUser) {
                return res.status(409).json({ error: 'User with this email already exists' });
            }

            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user
            const user = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password: hashedPassword,
                role: role.toLowerCase(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('users').insertOne(user);
            
            // Remove password from response
            delete user.password;
            user.id = result.insertedId;

            res.status(201).json({
                message: 'User created successfully',
                user
            });

        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update user
    updateUser: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, email, role, password } = req.body;

            const dbInstance = await connectDB();
            
            // Check if user exists
            const existingUser = await dbInstance.collection('users').findOne({ _id: new ObjectId(id) });
            if (!existingUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prepare update data
            const updateData = {
                updatedAt: new Date()
            };

            if (name) updateData.name = name.trim();
            if (email) updateData.email = email.trim().toLowerCase();
            if (role) {
                const validRoles = ['patient', 'doctor', 'admin'];
                if (!validRoles.includes(role.toLowerCase())) {
                    return res.status(400).json({ error: 'Invalid role' });
                }
                updateData.role = role.toLowerCase();
            }
            if (password) {
                const saltRounds = 10;
                updateData.password = await bcrypt.hash(password, saltRounds);
            }

            // Check for email conflicts (if email is being updated)
            if (email && email !== existingUser.email) {
                const emailExists = await dbInstance.collection('users').findOne({ 
                    email: email.trim().toLowerCase(),
                    _id: { $ne: new ObjectId(id) }
                });
                if (emailExists) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
            }

            const result = await dbInstance.collection('users').updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User updated successfully' });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete user
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;
            const dbInstance = await connectDB();

            // Check if user exists
            const user = await dbInstance.collection('users').findOne({ _id: new ObjectId(id) });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent self-deletion
            if (req.user.id === id) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            const result = await dbInstance.collection('users').deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });

        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get users by role
    getUsersByRole: async (req, res) => {
        try {
            const { role } = req.params;
            const dbInstance = await connectDB();
            
            const validRoles = ['patient', 'doctor', 'admin'];
            if (!validRoles.includes(role.toLowerCase())) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const users = await dbInstance.collection('users').find({ 
                role: role.toLowerCase() 
            }).toArray();

            // Remove passwords from response
            const safeUsers = users.map(user => {
                const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
                return safeUser;
            });

            res.json({ users: safeUsers });

        } catch (error) {
            console.error('Get users by role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = userController;
