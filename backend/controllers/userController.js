const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');
const authController = require('./authController');

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

            // Validate ObjectId format
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

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
            const { name, email, password, role, phone, dateOfBirth, address, specialization, licenseNumber, department, emergencyContact, medicalHistory, allergies } = req.body;

            // Validation
            if (!name || !email || !password || !role) {
                return res.status(400).json({ error: 'Name, email, password, and role are required' });
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

            // Create base user object
            const user = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password: hashedPassword,
                role: role.toLowerCase(),
                phone: phone?.trim() || '',
                address: address?.trim() || '',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Add role-specific fields
            if (role.toLowerCase() === 'doctor') {
                user.specialization = specialization?.trim() || '';
                user.licenseNumber = licenseNumber?.trim() || '';
                user.department = department?.trim() || '';
            } else if (role.toLowerCase() === 'patient') {
                user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
                user.emergencyContact = emergencyContact?.trim() || '';
                user.medicalHistory = medicalHistory?.trim() || '';
                user.allergies = allergies?.trim() || '';
            }

            const result = await dbInstance.collection('users').insertOne(user);

            // Send account creation email
            try {
                const emailResult = await authController.sendAccountCreationEmail({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    password: password, // Send the plain password for the email
                    role: role.toLowerCase()
                });

                if (emailResult.success) {
                    console.log('✅ Account creation email sent successfully');
                } else {
                    console.warn('⚠️ Failed to send account creation email:', emailResult.error);
                }
            } catch (emailError) {
                console.error('❌ Error sending account creation email:', emailError);
                // Don't fail the user creation if email fails
            }

            // Remove password from response
            delete user.password;
            user.id = result.insertedId;

            res.status(201).json({
                message: 'User created successfully',
                user: {
                    id: result.insertedId,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    address: user.address,
                    specialization: user.specialization || '',
                    licenseNumber: user.licenseNumber || '',
                    department: user.department || '',
                    dateOfBirth: user.dateOfBirth || null,
                    emergencyContact: user.emergencyContact || '',
                    medicalHistory: user.medicalHistory || '',
                    allergies: user.allergies || '',
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
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
            const { name, email, role, password, phone, dateOfBirth, address, specialization, licenseNumber, department, emergencyContact, medicalHistory, allergies } = req.body;

            // Validate ObjectId format
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

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

            // Update basic fields
            if (name) updateData.name = name.trim();
            if (email) updateData.email = email.trim().toLowerCase();
            if (phone !== undefined) updateData.phone = phone?.trim() || '';
            if (address !== undefined) updateData.address = address?.trim() || '';

            // Update role-specific fields
            if (role) {
                const validRoles = ['patient', 'doctor', 'admin'];
                if (!validRoles.includes(role.toLowerCase())) {
                    return res.status(400).json({ error: 'Invalid role' });
                }
                updateData.role = role.toLowerCase();

                // Clear role-specific fields when role changes
                if (role.toLowerCase() === 'doctor') {
                    updateData.specialization = specialization?.trim() || '';
                    updateData.licenseNumber = licenseNumber?.trim() || '';
                    updateData.department = department?.trim() || '';
                    // Clear patient fields
                    updateData.dateOfBirth = null;
                    updateData.emergencyContact = '';
                    updateData.medicalHistory = '';
                    updateData.allergies = '';
                } else if (role.toLowerCase() === 'patient') {
                    updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
                    updateData.emergencyContact = emergencyContact?.trim() || '';
                    updateData.medicalHistory = medicalHistory?.trim() || '';
                    updateData.allergies = allergies?.trim() || '';
                    // Clear doctor fields
                    updateData.specialization = '';
                    updateData.licenseNumber = '';
                    updateData.department = '';
                } else if (role.toLowerCase() === 'admin') {
                    // Clear all role-specific fields for admin
                    updateData.specialization = '';
                    updateData.licenseNumber = '';
                    updateData.department = '';
                    updateData.dateOfBirth = null;
                    updateData.emergencyContact = '';
                    updateData.medicalHistory = '';
                    updateData.allergies = '';
                }
            } else {
                // If role is not being updated, only update the specific fields for current role
                if (existingUser.role === 'doctor') {
                    if (specialization !== undefined) updateData.specialization = specialization?.trim() || '';
                    if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber?.trim() || '';
                    if (department !== undefined) updateData.department = department?.trim() || '';
                } else if (existingUser.role === 'patient') {
                    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
                    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact?.trim() || '';
                    if (medicalHistory !== undefined) updateData.medicalHistory = medicalHistory?.trim() || '';
                    if (allergies !== undefined) updateData.allergies = allergies?.trim() || '';
                }
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

            // Validate ObjectId format
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

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
