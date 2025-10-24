const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');
const authController = require('./authController');

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

// Helper function to safely convert string ID to ObjectId
const safeObjectId = (id) => {
    if (!id) return null;

    // If it's already an ObjectId, return it
    if (id instanceof ObjectId) return id;

    // If it's a string, validate and convert
    if (typeof id === 'string') {
        if (ObjectId.isValid(id)) {
            return new ObjectId(id);
        }
    }

    return null;
};

const userController = {
    // Get all users (Admin only)
    getAllUsers: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const users = await dbInstance.collection('users').find({}).toArray();

            // Get department names for doctors
            const departmentIds = [...new Set(users.filter(u => u.department).map(u => u.department))];
            const departments = await dbInstance.collection('departments')
                .find({ _id: { $in: departmentIds } })
                .toArray();

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            // Remove passwords from response and populate department names
            const safeUsers = users.map(user => {
                const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
                // Convert _id to id and ensure it's a string
                safeUser.id = user._id.toString();
                delete safeUser._id;

                // Add department name for doctors
                if (user.department) {
                    safeUser.departmentName = departmentMap[user.department.toString()] || 'Unknown';
                    safeUser.departmentId = user.department.toString();
                }

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

            // Safely convert ID to ObjectId
            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            const dbInstance = await connectDB();

            const user = await dbInstance.collection('users').findOne({ _id: objectId });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Remove sensitive data
            const { password, resetToken, resetTokenExpiry, ...safeUser } = user;
            safeUser.id = user._id.toString();
            delete safeUser._id;
            res.json({ user: safeUser });
        } catch (error) {
            console.error('Get user by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create new user (Admin only)
    createUser: async (req, res) => {
        try {
            // Check if req.body exists
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { name, email, password, role, phone, dateOfBirth, address, specialization, department, emergencyContact, medicalHistory, allergies } = req.body;

            // Enhanced validation
            if (!name || !email || !password || !role) {
                return res.status(400).json({ error: 'Name, email, password, and role are required' });
            }

            // Additional validation for doctor role
            if (role.toLowerCase() === 'doctor' && !department) {
                return res.status(400).json({ error: 'Department is required for doctor users' });
            }

            if (!validateEmail(email.trim())) {
                return res.status(400).json({ error: 'Please provide a valid email address' });
            }

            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                return res.status(400).json({ error: passwordValidation.message });
            }

            if (name.trim().length < 2) {
                return res.status(400).json({ error: 'Name must be at least 2 characters long' });
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

                // Validate and store department ID
                if (department) {
                    const departmentObjectId = safeObjectId(department);
                    if (!departmentObjectId) {
                        return res.status(400).json({ error: 'Invalid department ID format' });
                    }

                    // Verify department exists
                    const departmentExists = await dbInstance.collection('departments').findOne({
                        _id: departmentObjectId
                    });

                    if (!departmentExists) {
                        return res.status(400).json({ error: 'Department not found' });
                    }

                    user.department = departmentObjectId;
                } else {
                    user.department = null;
                }
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
            user.id = result.insertedId.toString();

            res.status(201).json({
                message: 'User created successfully',
                user: {
                    id: result.insertedId.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    address: user.address,
                    specialization: user.specialization || '',
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
            // Check if req.body exists
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { name, email, role, password, phone, dateOfBirth, address, specialization, department, emergencyContact, medicalHistory, allergies } = req.body;

            // Safely convert ID to ObjectId
            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            // Enhanced validation for provided fields
            if (email && !validateEmail(email.trim())) {
                return res.status(400).json({ error: 'Please provide a valid email address' });
            }

            if (name && name.trim().length < 2) {
                return res.status(400).json({ error: 'Name must be at least 2 characters long' });
            }

            if (password) {
                const passwordValidation = validatePassword(password);
                if (!passwordValidation.isValid) {
                    return res.status(400).json({ error: passwordValidation.message });
                }
            }

            const dbInstance = await connectDB();

            // Check if user exists
            const existingUser = await dbInstance.collection('users').findOne({ _id: objectId });
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
                    if (!department) {
                        return res.status(400).json({ error: 'Department is required for doctor users' });
                    }
                    updateData.specialization = specialization?.trim() || '';
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
                    updateData.department = '';
                } else if (role.toLowerCase() === 'admin') {
                    // Clear all role-specific fields for admin
                    updateData.specialization = '';
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
                    if (department !== undefined) {
                        if (!department) {
                            return res.status(400).json({ error: 'Department is required for doctor users' });
                        }
                        updateData.department = department?.trim() || '';
                    }
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
                    _id: { $ne: objectId }
                });
                if (emailExists) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
            }

            const result = await dbInstance.collection('users').updateOne(
                { _id: objectId },
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

            // Safely convert ID to ObjectId
            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }

            const dbInstance = await connectDB();

            // Check if user exists
            const user = await dbInstance.collection('users').findOne({ _id: objectId });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent self-deletion
            if (req.user.id === id) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            const result = await dbInstance.collection('users').deleteOne({ _id: objectId });

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
                // Convert _id to id and ensure it's a string
                safeUser.id = user._id.toString();
                delete safeUser._id;
                return safeUser;
            });

            res.json({ users: safeUsers });

        } catch (error) {
            console.error('Get users by role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update user profile (for authenticated users to update their own profile)
    updateProfile: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const userId = req.user.id;
            const { name, email, phone, address, specialization, department, schedule } = req.body;

            const dbInstance = await connectDB();

            // Check if user exists
            const existingUser = await dbInstance.collection('users').findOne({
                _id: safeObjectId(userId)
            });

            if (!existingUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Build update data
            const updateData = {
                updatedAt: new Date()
            };

            if (name) updateData.name = name.trim();
            if (email) {
                const trimmedEmail = email.trim().toLowerCase();
                if (!validateEmail(trimmedEmail)) {
                    return res.status(400).json({ error: 'Please provide a valid email address' });
                }

                // Check if email is already taken by another user
                const emailExists = await dbInstance.collection('users').findOne({
                    email: trimmedEmail,
                    _id: { $ne: safeObjectId(userId) }
                });

                if (emailExists) {
                    return res.status(400).json({ error: 'Email is already taken by another user' });
                }

                updateData.email = trimmedEmail;
            }
            if (phone !== undefined) updateData.phone = phone?.trim() || '';
            if (address !== undefined) updateData.address = address?.trim() || '';

            // Update role-specific fields for doctors
            if (existingUser.role === 'doctor') {
                if (specialization !== undefined) updateData.specialization = specialization?.trim() || '';
                if (department) {
                    // Validate department exists
                    const departmentExists = await dbInstance.collection('departments').findOne({
                        _id: safeObjectId(department)
                    });
                    if (!departmentExists) {
                        return res.status(400).json({ error: 'Department not found' });
                    }
                    updateData.department = safeObjectId(department);
                }
                if (schedule) {
                    updateData.schedule = schedule;
                }
            }

            // Update user
            const result = await dbInstance.collection('users').updateOne(
                { _id: safeObjectId(userId) },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get updated user data
            const updatedUser = await dbInstance.collection('users').findOne({
                _id: safeObjectId(userId)
            });

            // Remove sensitive data
            const { password, resetToken, resetTokenExpiry, ...safeUser } = updatedUser;
            safeUser.id = updatedUser._id.toString();
            delete safeUser._id;

            res.json({
                message: 'Profile updated successfully',
                user: safeUser
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = userController;
