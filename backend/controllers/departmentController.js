const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');

const departmentController = {
    // Get all departments
    getAllDepartments: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const departments = await dbInstance.collection('departments').find({}).sort({ name: 1 }).toArray();

            // Transform departments to include id field
            const transformedDepartments = departments.map(dept => ({
                id: dept._id.toString(),
                _id: dept._id,
                name: dept.name,
                description: dept.description,
                createdAt: dept.createdAt,
                updatedAt: dept.updatedAt
            }));

            res.json({ departments: transformedDepartments });
        } catch (error) {
            console.error('Get all departments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get department by ID
    getDepartmentById: async (req, res) => {
        try {
            const { id } = req.params;

            // Validate ObjectId format
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid department ID format' });
            }

            const dbInstance = await connectDB();

            const department = await dbInstance.collection('departments').findOne({ _id: new ObjectId(id) });

            if (!department) {
                return res.status(404).json({ error: 'Department not found' });
            }

            // Transform department to include id field
            const transformedDepartment = {
                id: department._id.toString(),
                _id: department._id,
                name: department.name,
                description: department.description,
                createdAt: department.createdAt,
                updatedAt: department.updatedAt
            };

            res.json({ department: transformedDepartment });
        } catch (error) {
            console.error('Get department by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create new department (Admin only)
    createDepartment: async (req, res) => {
        try {
            const { name, description } = req.body;

            // Validation
            if (!name) {
                return res.status(400).json({ error: 'Department name is required' });
            }

            const dbInstance = await connectDB();

            // Check if department already exists
            const existingDepartment = await dbInstance.collection('departments').findOne({
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
            });

            if (existingDepartment) {
                return res.status(409).json({ error: 'Department with this name already exists' });
            }

            // Create department
            const department = {
                name: name.trim(),
                description: description?.trim() || '',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('departments').insertOne(department);

            res.status(201).json({
                message: 'Department created successfully',
                department: {
                    id: result.insertedId.toString(),
                    _id: result.insertedId,
                    name: department.name,
                    description: department.description,
                    createdAt: department.createdAt,
                    updatedAt: department.updatedAt
                }
            });

        } catch (error) {
            console.error('Create department error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update department (Admin only)
    updateDepartment: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description } = req.body;

            // Validate ObjectId format
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid department ID format' });
            }

            const dbInstance = await connectDB();

            // Check if department exists
            const existingDepartment = await dbInstance.collection('departments').findOne({ _id: new ObjectId(id) });
            if (!existingDepartment) {
                return res.status(404).json({ error: 'Department not found' });
            }

            // Prepare update data
            const updateData = {
                updatedAt: new Date()
            };

            if (name) {
                // Check for name conflicts (if name is being updated)
                if (name !== existingDepartment.name) {
                    const nameExists = await dbInstance.collection('departments').findOne({
                        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                        _id: { $ne: new ObjectId(id) }
                    });

                    if (nameExists) {
                        return res.status(409).json({ error: 'Department with this name already exists' });
                    }
                }
                updateData.name = name.trim();
            }

            if (description !== undefined) {
                updateData.description = description?.trim() || '';
            }

            const result = await dbInstance.collection('departments').updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Department not found' });
            }

            res.json({
                message: 'Department updated successfully',
                department: {
                    id: id,
                    _id: new ObjectId(id),
                    name: updateData.name || existingDepartment.name,
                    description: updateData.description !== undefined ? updateData.description : existingDepartment.description,
                    createdAt: existingDepartment.createdAt,
                    updatedAt: updateData.updatedAt
                }
            });

        } catch (error) {
            console.error('Update department error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete department (Admin only)
    deleteDepartment: async (req, res) => {
        try {
            const { id } = req.params;

            // Validate ObjectId format
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ error: 'Invalid department ID format' });
            }

            const dbInstance = await connectDB();

            // Check if department exists
            const existingDepartment = await dbInstance.collection('departments').findOne({ _id: new ObjectId(id) });
            if (!existingDepartment) {
                return res.status(404).json({ error: 'Department not found' });
            }

            // Check if any users are assigned to this department
            const usersInDepartment = await dbInstance.collection('users').findOne({
                department: existingDepartment.name
            });

            if (usersInDepartment) {
                return res.status(400).json({
                    error: 'Cannot delete department. There are users assigned to this department.'
                });
            }

            const result = await dbInstance.collection('departments').deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Department not found' });
            }

            res.json({ message: 'Department deleted successfully' });

        } catch (error) {
            console.error('Delete department error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = departmentController;
