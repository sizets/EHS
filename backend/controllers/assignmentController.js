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

            // Handle department - use provided department ID or doctor's department
            let departmentId = null;
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

                departmentId = departmentObjectId;
            } else if (doctor.department) {
                // Use doctor's department if no department specified
                departmentId = doctor.department;
            }

            // Create assignment
            const assignment = {
                patientId: patientObjectId,
                doctorId: doctorObjectId,
                assignmentType: assignmentType.toLowerCase(),
                priority: priority || (assignmentType.toLowerCase() === 'emergency' ? 'high' : 'normal'),
                symptoms: symptoms?.trim() || '',
                notes: notes?.trim() || '',
                department: departmentId,
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
                    id: result.insertedId.toString(),
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

            // Get unique patient and doctor IDs
            const patientIds = [...new Set(assignments.map(a => a.patientId))];
            const doctorIds = [...new Set(assignments.map(a => a.doctorId))];
            const departmentIds = [...new Set(assignments.map(a => a.department).filter(Boolean))];

            // Fetch patients, doctors, and departments
            const [patients, doctors, departments] = await Promise.all([
                dbInstance.collection('users').find({ _id: { $in: patientIds } }).toArray(),
                dbInstance.collection('users').find({ _id: { $in: doctorIds } }).toArray(),
                dbInstance.collection('departments').find({ _id: { $in: departmentIds } }).toArray()
            ]);

            // Create lookup maps
            const patientMap = {};
            patients.forEach(patient => {
                patientMap[patient._id.toString()] = patient.name;
            });

            const doctorMap = {};
            doctors.forEach(doctor => {
                doctorMap[doctor._id.toString()] = doctor.name;
            });

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            // Format assignments with resolved names
            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                patientName: patientMap[assignment.patientId.toString()] || 'Unknown Patient',
                doctorName: doctorMap[assignment.doctorId.toString()] || 'Unknown Doctor',
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                department: assignment.department ? departmentMap[assignment.department.toString()] || 'Unknown' : 'Not assigned',
                departmentId: assignment.department ? assignment.department.toString() : null,
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

            // Get unique patient IDs and department IDs
            const patientIds = [...new Set(assignments.map(a => a.patientId))];
            const departmentIds = [...new Set(assignments.map(a => a.department).filter(Boolean))];

            // Fetch patients, doctor, and departments
            const [patients, doctor, departments] = await Promise.all([
                dbInstance.collection('users').find({ _id: { $in: patientIds } }).toArray(),
                dbInstance.collection('users').findOne({ _id: doctorObjectId }),
                dbInstance.collection('departments').find({ _id: { $in: departmentIds } }).toArray()
            ]);

            // Create lookup maps
            const patientMap = {};
            patients.forEach(patient => {
                patientMap[patient._id.toString()] = patient.name;
            });

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                patientName: patientMap[assignment.patientId.toString()] || 'Unknown Patient',
                doctorName: doctor ? doctor.name : 'Unknown Doctor',
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                department: assignment.department ? departmentMap[assignment.department.toString()] || 'Unknown' : 'Not assigned',
                departmentId: assignment.department ? assignment.department.toString() : null,
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

    // Get available doctors (emergency department + free)
    getAvailableDoctors: async (req, res) => {
        try {
            const dbInstance = await connectDB();

            // First, find the Emergency department ID (look for any department with "Emergency" in the name)
            const emergencyDept = await dbInstance.collection('departments').findOne({
                name: { $regex: /Emergency/i }
            });

            if (!emergencyDept) {
                return res.json({ doctors: [] });
            }

            // Get all doctors from emergency department
            const emergencyDoctors = await dbInstance.collection('users').find({
                role: 'doctor',
                department: emergencyDept._id
            }).toArray();

            if (emergencyDoctors.length === 0) {
                return res.json({ doctors: [] });
            }

            // Get doctor IDs
            const doctorIds = emergencyDoctors.map(doctor => doctor._id);

            // Find doctors who have active assignments (status: 'in_progress')
            const busyDoctors = await dbInstance.collection('assignments').find({
                doctorId: { $in: doctorIds },
                status: 'in_progress'
            }).toArray();

            // Get IDs of busy doctors
            const busyDoctorIds = busyDoctors.map(assignment => assignment.doctorId);

            // Filter out busy doctors
            const availableDoctors = emergencyDoctors.filter(doctor =>
                !busyDoctorIds.some(busyId => busyId.toString() === doctor._id.toString())
            );

            // Format response
            const formattedDoctors = availableDoctors.map(doctor => ({
                id: doctor._id.toString(),
                name: doctor.name,
                email: doctor.email,
                specialization: doctor.specialization || '',
                department: emergencyDept.name, // Return department name for compatibility
                departmentId: doctor.department ? doctor.department.toString() : null,
                phone: doctor.phone || '',
                address: doctor.address || ''
            }));

            res.json({ doctors: formattedDoctors });

        } catch (error) {
            console.error('Get available doctors error:', error);
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
    },

    // Get assignments for the current doctor (doctor-specific)
    getMyAssignments: async (req, res) => {
        try {
            const doctorId = req.user.id; // Get doctor ID from authenticated user

            const doctorObjectId = safeObjectId(doctorId);
            if (!doctorObjectId) {
                return res.status(400).json({ error: 'Invalid doctor ID format' });
            }

            const dbInstance = await connectDB();

            // Verify the user is a doctor
            const doctor = await dbInstance.collection('users').findOne({
                _id: doctorObjectId,
                role: 'doctor'
            });
            if (!doctor) {
                return res.status(403).json({ error: 'Access denied. Only doctors can view their assignments.' });
            }

            const assignments = await dbInstance.collection('assignments')
                .find({ doctorId: doctorObjectId })
                .sort({ assignedAt: -1 })
                .toArray();

            // Get unique patient IDs and department IDs
            const patientIds = [...new Set(assignments.map(a => a.patientId))];
            const departmentIds = [...new Set(assignments.map(a => a.department).filter(Boolean))];

            // Fetch patients and departments
            const [patients, departments] = await Promise.all([
                dbInstance.collection('users').find({ _id: { $in: patientIds } }).toArray(),
                dbInstance.collection('departments').find({ _id: { $in: departmentIds } }).toArray()
            ]);

            // Create lookup maps
            const patientMap = {};
            patients.forEach(patient => {
                patientMap[patient._id.toString()] = patient.name;
            });

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                patientName: patientMap[assignment.patientId.toString()] || 'Unknown Patient',
                doctorName: doctor.name, // Current doctor's name
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                department: assignment.department ? departmentMap[assignment.department.toString()] || 'Unknown' : 'Not assigned',
                departmentId: assignment.department ? assignment.department.toString() : null,
                status: assignment.status,
                assignedBy: assignment.assignedBy,
                assignedAt: assignment.assignedAt,
                createdAt: assignment.createdAt,
                updatedAt: assignment.updatedAt
            }));

            res.json({ assignments: formattedAssignments });
        } catch (error) {
            console.error('Get my assignments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get assignments for the current patient (patient-specific)
    getMyAssignmentsPatient: async (req, res) => {
        try {
            const patientId = req.user.id; // Get patient ID from authenticated user

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid patient ID format' });
            }

            const dbInstance = await connectDB();

            // Verify the user is a patient
            const patient = await dbInstance.collection('users').findOne({
                _id: patientObjectId,
                role: 'patient'
            });
            if (!patient) {
                return res.status(403).json({ error: 'Access denied. Only patients can view their assignments.' });
            }

            const assignments = await dbInstance.collection('assignments')
                .find({ patientId: patientObjectId })
                .sort({ assignedAt: -1 })
                .toArray();

            // Collect referenced doctor and department IDs
            const doctorIds = [...new Set(assignments.map(a => a.doctorId))];
            const departmentIds = [...new Set(assignments.map(a => a.department).filter(Boolean))];

            const [doctors, departments] = await Promise.all([
                dbInstance.collection('users').find({ _id: { $in: doctorIds } }).toArray(),
                dbInstance.collection('departments').find({ _id: { $in: departmentIds } }).toArray()
            ]);

            const doctorMap = {};
            doctors.forEach(doctor => {
                doctorMap[doctor._id.toString()] = doctor.name;
            });

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            const formattedAssignments = assignments.map(assignment => ({
                id: assignment._id.toString(),
                patientId: assignment.patientId.toString(),
                doctorId: assignment.doctorId.toString(),
                doctorName: doctorMap[assignment.doctorId.toString()] || 'Unknown Doctor',
                department: assignment.department ? (departmentMap[assignment.department.toString()] || 'Unknown') : 'Not assigned',
                departmentId: assignment.department ? assignment.department.toString() : null,
                status: assignment.status,
                assignmentType: assignment.assignmentType,
                priority: assignment.priority,
                symptoms: assignment.symptoms,
                notes: assignment.notes,
                assignedBy: assignment.assignedBy,
                assignedAt: assignment.assignedAt,
                createdAt: assignment.createdAt,
                updatedAt: assignment.updatedAt
            }));

            res.json({ assignments: formattedAssignments });
        } catch (error) {
            console.error('Get my assignments (patient) error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update assignment status for the current doctor (doctor-specific)
    updateMyAssignmentStatus: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { status, notes } = req.body;
            const doctorId = req.user.id; // Get doctor ID from authenticated user

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

            // Check if assignment exists and belongs to this doctor
            const existingAssignment = await dbInstance.collection('assignments').findOne({
                _id: objectId,
                doctorId: safeObjectId(doctorId)
            });
            if (!existingAssignment) {
                return res.status(404).json({ error: 'Assignment not found or you do not have permission to update this assignment' });
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
            console.error('Update my assignment status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = assignmentController;
