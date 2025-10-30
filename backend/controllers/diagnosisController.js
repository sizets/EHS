const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');

// Helper function to safely convert string ID to ObjectId
const safeObjectId = (id) => {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
    return null;
};

const diagnosisController = {
    // Create a new diagnosis (doctor/admin)
    createDiagnosis: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { assignmentId, diagnosisName, description } = req.body;
            if (!assignmentId || !diagnosisName) {
                return res.status(400).json({ error: 'Assignment ID and Diagnosis Name are required' });
            }

            const assignmentObjectId = safeObjectId(assignmentId);
            if (!assignmentObjectId) {
                return res.status(400).json({ error: 'Invalid Assignment ID format' });
            }

            const dbInstance = await connectDB();

            const assignment = await dbInstance.collection('assignments').findOne({ _id: assignmentObjectId });
            if (!assignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            // Only allow diagnosis if assignment is in_progress
            if (assignment.status !== 'in_progress') {
                return res.status(400).json({
                    error: 'Diagnosis can only be added to assignments that are in progress. Once completed, diagnoses cannot be added.'
                });
            }

            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can create diagnoses' });
            }

            let doctorId;
            if (userRole === 'doctor') {
                doctorId = safeObjectId(req.user.id);
            } else {
                doctorId = assignment.doctorId;
            }

            const doctor = await dbInstance.collection('users').findOne({ _id: doctorId, role: 'doctor' });
            if (!doctor) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            const diagnosis = {
                assignmentId: assignmentObjectId,
                diagnosisName: diagnosisName.trim(),
                description: description?.trim() || '',
                diagnosedBy: doctorId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('diagnoses').insertOne(diagnosis);

            res.status(201).json({
                message: 'Diagnosis created successfully',
                diagnosis: {
                    id: result.insertedId.toString(),
                    assignmentId: assignmentObjectId.toString(),
                    diagnosisName: diagnosis.diagnosisName,
                    description: diagnosis.description,
                    diagnosedBy: doctorId.toString(),
                    diagnosedByName: doctor.name,
                    createdAt: diagnosis.createdAt
                }
            });
        } catch (error) {
            console.error('Create diagnosis error:', error);
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
            const diagnosis = await dbInstance.collection('diagnoses').findOne({ _id: diagnosisObjectId });
            if (!diagnosis) {
                return res.status(404).json({ error: 'Diagnosis not found' });
            }

            const doctor = await dbInstance.collection('users').findOne({ _id: diagnosis.diagnosedBy });
            const formattedDiagnosis = {
                id: diagnosis._id.toString(),
                assignmentId: diagnosis.assignmentId.toString(),
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: diagnosis.diagnosedBy.toString(),
                diagnosedByName: doctor?.name || 'Unknown',
                createdAt: diagnosis.createdAt,
                updatedAt: diagnosis.updatedAt
            };

            res.status(200).json({ diagnosis: formattedDiagnosis });
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
            const assignment = await dbInstance.collection('assignments').findOne({ _id: assignmentObjectId });
            if (!assignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            // Authorization: patients can only view diagnoses for their own assignments
            const userRole = req.user.role || 'patient';
            if (userRole === 'patient') {
                const requestUserId = safeObjectId(req.user.id);
                if (!requestUserId || assignment.patientId.toString() !== requestUserId.toString()) {
                    return res.status(403).json({ error: 'Access denied. You can only view your own diagnoses.' });
                }
            }

            const diagnoses = await dbInstance.collection('diagnoses')
                .find({ assignmentId: assignmentObjectId })
                .sort({ createdAt: -1 })
                .toArray();

            const doctorIds = [...new Set(diagnoses.map(d => d.diagnosedBy))];
            const doctors = await dbInstance.collection('users').find({ _id: { $in: doctorIds } }).toArray();
            const doctorMap = {};
            doctors.forEach(doc => { doctorMap[doc._id.toString()] = doc.name; });

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
            const diagnosis = await dbInstance.collection('diagnoses').findOne({ _id: diagnosisObjectId });
            if (!diagnosis) {
                return res.status(404).json({ error: 'Diagnosis not found' });
            }

            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can update diagnoses' });
            }

            if (userRole === 'doctor') {
                const doctorId = safeObjectId(req.user.id);
                if (!diagnosis.diagnosedBy.equals(doctorId)) {
                    return res.status(403).json({ error: 'You can only update diagnoses you created' });
                }
            }

            const update = {
                updatedAt: new Date()
            };
            if (diagnosisName) update.diagnosisName = diagnosisName.trim();
            if (typeof description === 'string') update.description = description.trim();

            await dbInstance.collection('diagnoses').updateOne({ _id: diagnosisObjectId }, { $set: update });
            res.status(200).json({ message: 'Diagnosis updated successfully' });
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
            const diagnosis = await dbInstance.collection('diagnoses').findOne({ _id: diagnosisObjectId });
            if (!diagnosis) {
                return res.status(404).json({ error: 'Diagnosis not found' });
            }

            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can delete diagnoses' });
            }

            if (userRole === 'doctor') {
                const doctorId = safeObjectId(req.user.id);
                if (!diagnosis.diagnosedBy.equals(doctorId)) {
                    return res.status(403).json({ error: 'You can only delete diagnoses you created' });
                }
            }

            await dbInstance.collection('diagnoses').deleteOne({ _id: diagnosisObjectId });
            res.status(200).json({ message: 'Diagnosis deleted successfully' });
        } catch (error) {
            console.error('Delete diagnosis error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // List all diagnoses (admin/doctor)
    getAllDiagnoses: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const diagnoses = await dbInstance.collection('diagnoses').find({}).sort({ createdAt: -1 }).toArray();
            res.json({
                diagnoses: diagnoses.map(d => ({
                    id: d._id.toString(),
                    assignmentId: d.assignmentId.toString(),
                    diagnosisName: d.diagnosisName,
                    description: d.description,
                    diagnosedBy: d.diagnosedBy.toString(),
                    createdAt: d.createdAt,
                    updatedAt: d.updatedAt
                }))
            });
        } catch (error) {
            console.error('Get all diagnoses error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = diagnosisController;


