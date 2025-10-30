const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');

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

const diagnosisController = {
    // Create a new diagnosis
    createDiagnosis: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { assignmentId, diagnosisName, description } = req.body;

            // Validation
            if (!assignmentId || !diagnosisName) {
                return res.status(400).json({ error: 'Assignment ID and Diagnosis Name are required' });
            }

            // Safely convert IDs to ObjectIds
            const assignmentObjectId = safeObjectId(assignmentId);
            if (!assignmentObjectId) {
                return res.status(400).json({ error: 'Invalid Assignment ID format' });
            }

            // Validate diagnosis name length
            if (diagnosisName.trim().length < 2) {
                return res.status(400).json({ error: 'Diagnosis name must be at least 2 characters long' });
            }

            const dbInstance = await connectDB();

            // Verify assignment exists
            const assignment = await dbInstance.collection('assignments').findOne({
                _id: assignmentObjectId
            });

            if (!assignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            // Only allow diagnosis if assignment is in_progress
            if (assignment.status !== 'in_progress') {
                return res.status(400).json({
                    error: 'Diagnosis can only be added to assignments that are in progress. Once completed, diagnoses cannot be added.'
                });
            }

            // Check if user is doctor or admin
            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can create diagnoses' });
            }

            // Get doctor ID - if admin is creating, use the assignment's doctorId
            let doctorId;
            if (userRole === 'doctor') {
                doctorId = safeObjectId(req.user.id);
            } else {
                // Admin creating diagnosis - use assignment's doctor
                doctorId = assignment.doctorId;
            }

            // Verify doctor exists
            const doctor = await dbInstance.collection('users').findOne({
                _id: doctorId,
                role: 'doctor'
            });

            if (!doctor) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            // Create diagnosis
            const diagnosis = {
                assignmentId: assignmentObjectId,
                diagnosisName: diagnosisName.trim(),
                description: description?.trim() || '',
                diagnosedBy: doctorId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('diagnoses').insertOne(diagnosis);

            // Format response
            const createdDiagnosis = {
                id: result.insertedId.toString(),
                assignmentId: assignmentObjectId.toString(),
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: doctorId.toString(),
                diagnosedByName: doctor.name,
                createdAt: diagnosis.createdAt
            };

            res.status(201).json({
                message: 'Diagnosis created successfully',
                diagnosis: createdDiagnosis
            });

        } catch (error) {
            console.error('Create diagnosis error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all diagnoses
    getAllDiagnoses: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const diagnoses = await dbInstance.collection('diagnoses')
                .find({})
                .sort({ createdAt: -1 })
                .toArray();

            // Get unique assignment and doctor IDs
            const assignmentIds = [...new Set(diagnoses.map(d => d.assignmentId))];
            const doctorIds = [...new Set(diagnoses.map(d => d.diagnosedBy))];

            // Fetch assignments and doctors
            const [assignments, doctors] = await Promise.all([
                dbInstance.collection('assignments').find({ _id: { $in: assignmentIds } }).toArray(),
                dbInstance.collection('users').find({ _id: { $in: doctorIds } }).toArray()
            ]);

            // Create lookup maps
            const assignmentMap = {};
            assignments.forEach(assignment => {
                assignmentMap[assignment._id.toString()] = assignment;
            });

            const doctorMap = {};
            doctors.forEach(doctor => {
                doctorMap[doctor._id.toString()] = doctor.name;
            });

            // Format diagnoses with resolved names
            const formattedDiagnoses = diagnoses.map(diagnosis => ({
                id: diagnosis._id.toString(),
                assignmentId: diagnosis.assignmentId.toString(),
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: diagnosis.diagnosedBy.toString(),
                diagnosedByName: doctorMap[diagnosis.diagnosedBy.toString()] || 'Unknown',
                assignment: assignmentMap[diagnosis.assignmentId.toString()] ? {
                    id: assignmentMap[diagnosis.assignmentId.toString()]._id.toString(),
                    patientId: assignmentMap[diagnosis.assignmentId.toString()].patientId.toString(),
                    doctorId: assignmentMap[diagnosis.assignmentId.toString()].doctorId.toString(),
                    status: assignmentMap[diagnosis.assignmentId.toString()].status
                } : null,
                createdAt: diagnosis.createdAt,
                updatedAt: diagnosis.updatedAt
            }));

            res.status(200).json({
                diagnoses: formattedDiagnoses
            });

        } catch (error) {
            console.error('Get all diagnoses error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get diagnosis by ID
    getDiagnosisById: async (req, res) => {
        try {
            const { id } = req.params;

            const diagnosisObjectId = safeObjectId(id);
            if (!diagnosisObjectId) {
                return res.status(400).json({ error: 'Invalid Diagnosis ID format' });
            }

            const dbInstance = await connectDB();
            const diagnosis = await dbInstance.collection('diagnoses').findOne({
                _id: diagnosisObjectId
            });

            if (!diagnosis) {
                return res.status(404).json({ error: 'Diagnosis not found' });
            }

            // Get assignment and doctor details
            const [assignment, doctor] = await Promise.all([
                dbInstance.collection('assignments').findOne({ _id: diagnosis.assignmentId }),
                dbInstance.collection('users').findOne({ _id: diagnosis.diagnosedBy })
            ]);

            const formattedDiagnosis = {
                id: diagnosis._id.toString(),
                assignmentId: diagnosis.assignmentId.toString(),
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: diagnosis.diagnosedBy.toString(),
                diagnosedByName: doctor ? doctor.name : 'Unknown',
                assignment: assignment ? {
                    id: assignment._id.toString(),
                    patientId: assignment.patientId.toString(),
                    doctorId: assignment.doctorId.toString(),
                    status: assignment.status
                } : null,
                createdAt: diagnosis.createdAt,
                updatedAt: diagnosis.updatedAt
            };

            res.status(200).json({
                diagnosis: formattedDiagnosis
            });

        } catch (error) {
            console.error('Get diagnosis by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get diagnoses by assignment ID
    getDiagnosesByAssignment: async (req, res) => {
        try {
            const { assignmentId } = req.params;

            const assignmentObjectId = safeObjectId(assignmentId);
            if (!assignmentObjectId) {
                return res.status(400).json({ error: 'Invalid Assignment ID format' });
            }

            const dbInstance = await connectDB();

            // Verify assignment exists
            const assignment = await dbInstance.collection('assignments').findOne({
                _id: assignmentObjectId
            });

            if (!assignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            // Get diagnoses for this assignment
            const diagnoses = await dbInstance.collection('diagnoses')
                .find({ assignmentId: assignmentObjectId })
                .sort({ createdAt: -1 })
                .toArray();

            // Get doctor IDs
            const doctorIds = [...new Set(diagnoses.map(d => d.diagnosedBy))];
            const doctors = await dbInstance.collection('users').find({
                _id: { $in: doctorIds }
            }).toArray();

            // Create doctor map
            const doctorMap = {};
            doctors.forEach(doctor => {
                doctorMap[doctor._id.toString()] = doctor.name;
            });

            // Format diagnoses
            const formattedDiagnoses = diagnoses.map(diagnosis => ({
                id: diagnosis._id.toString(),
                assignmentId: diagnosis.assignmentId.toString(),
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: diagnosis.diagnosedBy.toString(),
                diagnosedByName: doctorMap[diagnosis.diagnosedBy.toString()] || 'Unknown',
                createdAt: diagnosis.createdAt,
                updatedAt: diagnosis.updatedAt
            }));

            res.status(200).json({
                diagnoses: formattedDiagnoses,
                assignment: {
                    id: assignment._id.toString(),
                    patientId: assignment.patientId.toString(),
                    doctorId: assignment.doctorId.toString(),
                    status: assignment.status
                }
            });

        } catch (error) {
            console.error('Get diagnoses by assignment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update diagnosis
    updateDiagnosis: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { diagnosisName, description } = req.body;

            const diagnosisObjectId = safeObjectId(id);
            if (!diagnosisObjectId) {
                return res.status(400).json({ error: 'Invalid Diagnosis ID format' });
            }

            const dbInstance = await connectDB();

            // Find diagnosis
            const diagnosis = await dbInstance.collection('diagnoses').findOne({
                _id: diagnosisObjectId
            });

            if (!diagnosis) {
                return res.status(404).json({ error: 'Diagnosis not found' });
            }

            // Check if user is doctor or admin
            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can update diagnoses' });
            }

            // If doctor, verify they created this diagnosis
            if (userRole === 'doctor') {
                const doctorId = safeObjectId(req.user.id);
                if (!diagnosis.diagnosedBy.equals(doctorId)) {
                    return res.status(403).json({ error: 'You can only update diagnoses you created' });
                }
            }

            // Prepare update data
            const updateData = {
                updatedAt: new Date()
            };

            if (diagnosisName !== undefined) {
                if (diagnosisName.trim().length < 2) {
                    return res.status(400).json({ error: 'Diagnosis name must be at least 2 characters long' });
                }
                updateData.diagnosisName = diagnosisName.trim();
            }

            if (description !== undefined) {
                updateData.description = description.trim();
            }

            // Update diagnosis
            await dbInstance.collection('diagnoses').updateOne(
                { _id: diagnosisObjectId },
                { $set: updateData }
            );

            // Get updated diagnosis
            const updatedDiagnosis = await dbInstance.collection('diagnoses').findOne({
                _id: diagnosisObjectId
            });

            // Get doctor name
            const doctor = await dbInstance.collection('users').findOne({
                _id: updatedDiagnosis.diagnosedBy
            });

            const formattedDiagnosis = {
                id: updatedDiagnosis._id.toString(),
                assignmentId: updatedDiagnosis.assignmentId.toString(),
                diagnosisName: updatedDiagnosis.diagnosisName,
                description: updatedDiagnosis.description,
                diagnosedBy: updatedDiagnosis.diagnosedBy.toString(),
                diagnosedByName: doctor ? doctor.name : 'Unknown',
                createdAt: updatedDiagnosis.createdAt,
                updatedAt: updatedDiagnosis.updatedAt
            };

            res.status(200).json({
                message: 'Diagnosis updated successfully',
                diagnosis: formattedDiagnosis
            });

        } catch (error) {
            console.error('Update diagnosis error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete diagnosis
    deleteDiagnosis: async (req, res) => {
        try {
            const { id } = req.params;

            const diagnosisObjectId = safeObjectId(id);
            if (!diagnosisObjectId) {
                return res.status(400).json({ error: 'Invalid Diagnosis ID format' });
            }

            const dbInstance = await connectDB();

            // Find diagnosis
            const diagnosis = await dbInstance.collection('diagnoses').findOne({
                _id: diagnosisObjectId
            });

            if (!diagnosis) {
                return res.status(404).json({ error: 'Diagnosis not found' });
            }

            // Check if user is doctor or admin
            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can delete diagnoses' });
            }

            // If doctor, verify they created this diagnosis
            if (userRole === 'doctor') {
                const doctorId = safeObjectId(req.user.id);
                if (!diagnosis.diagnosedBy.equals(doctorId)) {
                    return res.status(403).json({ error: 'You can only delete diagnoses you created' });
                }
            }

            // Delete diagnosis
            await dbInstance.collection('diagnoses').deleteOne({
                _id: diagnosisObjectId
            });

            res.status(200).json({
                message: 'Diagnosis deleted successfully'
            });

        } catch (error) {
            console.error('Delete diagnosis error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = diagnosisController;

