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

const assignmentController = {
    // Create new patient-doctor assignment
    createAssignment: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const {
                patientId,
                doctorId,
                assignmentType,
                priority,
                symptoms,
                notes,
                department
            } = req.body;

            // Validation
            if (!patientId || !doctorId || !assignmentType) {
                return res.status(400).json({ error: 'Patient ID, Doctor ID, and Assignment Type are required' });
            }

            // Safely convert IDs to ObjectIds
            const patientObjectId = safeObjectId(patientId);
            const doctorObjectId = safeObjectId(doctorId);

            if (!patientObjectId || !doctorObjectId) {
                return res.status(400).json({ error: 'Invalid Patient or Doctor ID format' });
            }

            // Validate assignment type
            const validTypes = ['emergency', 'casual'];
            if (!validTypes.includes(assignmentType.toLowerCase())) {
                return res.status(400).json({ error: 'Assignment type must be either "emergency" or "casual"' });
            }

            // Validate priority for emergency cases
            if (assignmentType.toLowerCase() === 'emergency' && !priority) {
                return res.status(400).json({ error: 'Priority is required for emergency assignments' });
            }

            const dbInstance = await connectDB();

            // Verify patient exists
            const patient = await dbInstance.collection('users').findOne({
                _id: patientObjectId,
                role: 'patient'
            });
            if (!patient) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            // Verify doctor exists
            const doctor = await dbInstance.collection('users').findOne({
                _id: doctorObjectId,
                role: 'doctor'
            });
            if (!doctor) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            // Check if there's already an active assignment for this patient
            const existingAssignment = await dbInstance.collection('assignments').findOne({
                patientId: patientObjectId,
                status: { $in: ['assigned', 'in_progress'] }
            });

            if (existingAssignment) {
                return res.status(409).json({
                    error: 'Patient already has an active assignment',
                    existingAssignment: {
                        id: existingAssignment._id,
                        doctorName: existingAssignment.doctorName,
                        assignedAt: existingAssignment.assignedAt,
                        status: existingAssignment.status
                    }
                });
            }

            // Create assignment
            const assignment = {
                patientId: patientObjectId,
                doctorId: doctorObjectId,
                patientName: patient.name,
                doctorName: doctor.name,
                assignmentType: assignmentType.toLowerCase(),
                priority: priority || (assignmentType.toLowerCase() === 'emergency' ? 'high' : 'normal'),
                symptoms: symptoms?.trim() || '',
                notes: notes?.trim() || '',
                department: department?.trim() || doctor.department || '',
                status: 'assigned',
                assignedBy: req.user.id, // Admin who created the assignment
                assignedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('assignments').insertOne(assignment);

            res.status(201).json({
                message: 'Assignment created successfully',
                assignment: {
                    id: result.insertedId,
                    ...assignment,
                    patientId: assignment.patientId.toString(),
                    doctorId: assignment.doctorId.toString(),
                    assignedBy: assignment.assignedBy
                }
            });

        } catch (error) {
            console.error('Create assignment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all assignments
    getAllAssignments: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const assignments = await dbInstance.collection('assignments')
                .find({})
                .sort({ assignedAt: -1 })
                .toArray();

            // Convert ObjectIds to strings for JSON response
            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                patientName: assignment.patientName,
                doctorName: assignment.doctorName,
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                department: assignment.department,
                status: assignment.status,
                assignedBy: assignment.assignedBy,
                assignedAt: assignment.assignedAt,
                createdAt: assignment.createdAt,
                updatedAt: assignment.updatedAt
            }));

            res.json({ assignments: formattedAssignments });
        } catch (error) {
            console.error('Get all assignments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get assignment by ID
    getAssignmentById: async (req, res) => {
        try {
            const { id } = req.params;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid assignment ID format' });
            }

            const dbInstance = await connectDB();
            const assignment = await dbInstance.collection('assignments').findOne({
                _id: objectId
            });

            if (!assignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            res.json({
                assignment: {
                    id: assignment._id.toString(),
                    patientId: assignment.patientId.toString(),
                    doctorId: assignment.doctorId.toString(),
                    patientName: assignment.patientName,
                    doctorName: assignment.doctorName,
                    assignmentType: assignment.assignmentType,
                    priority: assignment.priority,
                    symptoms: assignment.symptoms,
                    notes: assignment.notes,
                    department: assignment.department,
                    status: assignment.status,
                    assignedBy: assignment.assignedBy,
                    assignedAt: assignment.assignedAt,
                    createdAt: assignment.createdAt,
                    updatedAt: assignment.updatedAt
                }
            });
        } catch (error) {
            console.error('Get assignment by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update assignment status
    updateAssignmentStatus: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { status, notes } = req.body;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid assignment ID format' });
            }

            // Validate status
            const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
            if (!status || !validStatuses.includes(status.toLowerCase())) {
                return res.status(400).json({ error: 'Valid status is required (assigned, in_progress, completed, cancelled)' });
            }

            const dbInstance = await connectDB();

            // Check if assignment exists
            const existingAssignment = await dbInstance.collection('assignments').findOne({
                _id: objectId
            });
            if (!existingAssignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            // Update assignment
            const updateData = {
                status: status.toLowerCase(),
                updatedAt: new Date()
            };

            if (notes) {
                updateData.notes = notes.trim();
            }

            const result = await dbInstance.collection('assignments').updateOne(
                { _id: objectId },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            res.json({ message: 'Assignment status updated successfully' });

        } catch (error) {
            console.error('Update assignment status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get assignments by patient ID
    getAssignmentsByPatient: async (req, res) => {
        try {
            const { patientId } = req.params;

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid patient ID format' });
            }

            const dbInstance = await connectDB();
            const assignments = await dbInstance.collection('assignments')
                .find({ patientId: patientObjectId })
                .sort({ assignedAt: -1 })
                .toArray();

            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                patientName: assignment.patientName,
                doctorName: assignment.doctorName,
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                department: assignment.department,
                status: assignment.status,
                assignedBy: assignment.assignedBy,
                assignedAt: assignment.assignedAt,
                createdAt: assignment.createdAt,
                updatedAt: assignment.updatedAt
            }));

            res.json({ assignments: formattedAssignments });
        } catch (error) {
            console.error('Get assignments by patient error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get assignments by doctor ID
    getAssignmentsByDoctor: async (req, res) => {
        try {
            const { doctorId } = req.params;

            const doctorObjectId = safeObjectId(doctorId);
            if (!doctorObjectId) {
                return res.status(400).json({ error: 'Invalid doctor ID format' });
            }

            const dbInstance = await connectDB();
            const assignments = await dbInstance.collection('assignments')
                .find({ doctorId: doctorObjectId })
                .sort({ assignedAt: -1 })
                .toArray();

            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                patientName: assignment.patientName,
                doctorName: assignment.doctorName,
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                department: assignment.department,
                status: assignment.status,
                assignedBy: assignment.assignedBy,
                assignedAt: assignment.assignedAt,
                createdAt: assignment.createdAt,
                updatedAt: assignment.updatedAt
            }));

            res.json({ assignments: formattedAssignments });
        } catch (error) {
            console.error('Get assignments by doctor error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete assignment
    deleteAssignment: async (req, res) => {
        try {
            const { id } = req.params;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid assignment ID format' });
            }

            const dbInstance = await connectDB();

            // Check if assignment exists
            const assignment = await dbInstance.collection('assignments').findOne({
                _id: objectId
            });
            if (!assignment) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            const result = await dbInstance.collection('assignments').deleteOne({
                _id: objectId
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Assignment not found' });
            }

            res.json({ message: 'Assignment deleted successfully' });

        } catch (error) {
            console.error('Delete assignment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = assignmentController;
