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

            const { assignmentId, appointmentId, diagnosisName, description } = req.body;

            // Validation - must have either assignmentId or appointmentId, but not both
            if ((!assignmentId && !appointmentId) || (assignmentId && appointmentId)) {
                return res.status(400).json({ error: 'Either Assignment ID or Appointment ID (but not both) and Diagnosis Name are required' });
            }

            if (!diagnosisName) {
                return res.status(400).json({ error: 'Diagnosis Name is required' });
            }

            // Validate diagnosis name length
            if (diagnosisName.trim().length < 2) {
                return res.status(400).json({ error: 'Diagnosis name must be at least 2 characters long' });
            }

            const dbInstance = await connectDB();
            let sourceObject = null;
            let sourceType = null;
            let sourceObjectId = null;

            // Check if it's an assignment or appointment
            if (assignmentId) {
                sourceObjectId = safeObjectId(assignmentId);
                if (!sourceObjectId) {
                    return res.status(400).json({ error: 'Invalid Assignment ID format' });
                }

                sourceObject = await dbInstance.collection('assignments').findOne({
                    _id: sourceObjectId
                });

                if (!sourceObject) {
                    return res.status(404).json({ error: 'Assignment not found' });
                }

                // Only allow diagnosis if assignment is in_progress
                if (sourceObject.status !== 'in_progress') {
                    return res.status(400).json({
                        error: 'Diagnosis can only be added to assignments that are in progress. Once completed, diagnoses cannot be added.'
                    });
                }

                sourceType = 'assignment';
            } else if (appointmentId) {
                sourceObjectId = safeObjectId(appointmentId);
                if (!sourceObjectId) {
                    return res.status(400).json({ error: 'Invalid Appointment ID format' });
                }

                sourceObject = await dbInstance.collection('appointments').findOne({
                    _id: sourceObjectId
                });

                if (!sourceObject) {
                    return res.status(404).json({ error: 'Appointment not found' });
                }

                // Only allow diagnosis if appointment is confirmed or completed
                if (sourceObject.status !== 'confirmed' && sourceObject.status !== 'completed') {
                    return res.status(400).json({
                        error: 'Diagnosis can only be added to appointments that are confirmed or completed.'
                    });
                }

                sourceType = 'appointment';
            }

            // Check if user is doctor or admin
            const userRole = req.user.role || 'patient';
            if (userRole !== 'doctor' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Only doctors and admins can create diagnoses' });
            }

            // Get doctor ID - if admin is creating, use the source's doctorId
            let doctorId;
            if (userRole === 'doctor') {
                doctorId = safeObjectId(req.user.id);
            } else {
                // Admin creating diagnosis - use source's doctor
                doctorId = sourceObject.doctorId;
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
                diagnosisName: diagnosisName.trim(),
                description: description?.trim() || '',
                diagnosedBy: doctorId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Add assignmentId or appointmentId based on source type
            if (sourceType === 'assignment') {
                diagnosis.assignmentId = sourceObjectId;
            } else if (sourceType === 'appointment') {
                diagnosis.appointmentId = sourceObjectId;
            }

            const result = await dbInstance.collection('diagnoses').insertOne(diagnosis);

            // Format response
            const createdDiagnosis = {
                id: result.insertedId.toString(),
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: doctorId.toString(),
                diagnosedByName: doctor.name,
                createdAt: diagnosis.createdAt
            };

            if (sourceType === 'assignment') {
                createdDiagnosis.assignmentId = sourceObjectId.toString();
            } else if (sourceType === 'appointment') {
                createdDiagnosis.appointmentId = sourceObjectId.toString();
            }

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

            // Get unique assignment, appointment and doctor IDs
            const assignmentIds = [...new Set(diagnoses.map(d => d.assignmentId).filter(Boolean))];
            const appointmentIds = [...new Set(diagnoses.map(d => d.appointmentId).filter(Boolean))];
            const doctorIds = [...new Set(diagnoses.map(d => d.diagnosedBy))];

            // Fetch assignments, appointments and doctors
            const [assignments, appointments, doctors] = await Promise.all([
                assignmentIds.length > 0 ? dbInstance.collection('assignments').find({ _id: { $in: assignmentIds } }).toArray() : [],
                appointmentIds.length > 0 ? dbInstance.collection('appointments').find({ _id: { $in: appointmentIds } }).toArray() : [],
                dbInstance.collection('users').find({ _id: { $in: doctorIds } }).toArray()
            ]);

            // Create lookup maps
            const assignmentMap = {};
            assignments.forEach(assignment => {
                assignmentMap[assignment._id.toString()] = assignment;
            });

            const appointmentMap = {};
            appointments.forEach(appointment => {
                appointmentMap[appointment._id.toString()] = appointment;
            });

            const doctorMap = {};
            doctors.forEach(doctor => {
                doctorMap[doctor._id.toString()] = doctor.name;
            });

            // Format diagnoses with resolved names
            const formattedDiagnoses = diagnoses.map(diagnosis => {
                const formatted = {
                    id: diagnosis._id.toString(),
                    assignmentId: diagnosis.assignmentId ? diagnosis.assignmentId.toString() : null,
                    appointmentId: diagnosis.appointmentId ? diagnosis.appointmentId.toString() : null,
                    diagnosisName: diagnosis.diagnosisName,
                    description: diagnosis.description,
                    diagnosedBy: diagnosis.diagnosedBy.toString(),
                    diagnosedByName: doctorMap[diagnosis.diagnosedBy.toString()] || 'Unknown',
                    createdAt: diagnosis.createdAt,
                    updatedAt: diagnosis.updatedAt
                };

                // Add assignment or appointment details
                if (diagnosis.assignmentId) {
                    const assignment = assignmentMap[diagnosis.assignmentId.toString()];
                    formatted.assignment = assignment ? {
                        id: assignment._id.toString(),
                        patientId: assignment.patientId.toString(),
                        doctorId: assignment.doctorId.toString(),
                        status: assignment.status
                    } : null;
                }

                if (diagnosis.appointmentId) {
                    const appointment = appointmentMap[diagnosis.appointmentId.toString()];
                    formatted.appointment = appointment ? {
                        id: appointment._id.toString(),
                        patientId: appointment.patientId.toString(),
                        doctorId: appointment.doctorId.toString(),
                        status: appointment.status
                    } : null;
                }

                return formatted;
            });

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

            // Get assignment, appointment and doctor details
            const [assignment, appointment, doctor] = await Promise.all([
                diagnosis.assignmentId ? dbInstance.collection('assignments').findOne({ _id: diagnosis.assignmentId }) : null,
                diagnosis.appointmentId ? dbInstance.collection('appointments').findOne({ _id: diagnosis.appointmentId }) : null,
                dbInstance.collection('users').findOne({ _id: diagnosis.diagnosedBy })
            ]);

            const formattedDiagnosis = {
                id: diagnosis._id.toString(),
                assignmentId: diagnosis.assignmentId ? diagnosis.assignmentId.toString() : null,
                appointmentId: diagnosis.appointmentId ? diagnosis.appointmentId.toString() : null,
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: diagnosis.diagnosedBy.toString(),
                diagnosedByName: doctor ? doctor.name : 'Unknown',
                createdAt: diagnosis.createdAt,
                updatedAt: diagnosis.updatedAt
            };

            if (assignment) {
                formattedDiagnosis.assignment = {
                    id: assignment._id.toString(),
                    patientId: assignment.patientId.toString(),
                    doctorId: assignment.doctorId.toString(),
                    status: assignment.status
                };
            }

            if (appointment) {
                formattedDiagnosis.appointment = {
                    id: appointment._id.toString(),
                    patientId: appointment.patientId.toString(),
                    doctorId: appointment.doctorId.toString(),
                    status: appointment.status
                };
            }

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
                assignmentId: diagnosis.assignmentId ? diagnosis.assignmentId.toString() : null,
                appointmentId: diagnosis.appointmentId ? diagnosis.appointmentId.toString() : null,
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

    // Get diagnoses by appointment ID
    getDiagnosesByAppointment: async (req, res) => {
        try {
            const { appointmentId } = req.params;

            const appointmentObjectId = safeObjectId(appointmentId);
            if (!appointmentObjectId) {
                return res.status(400).json({ error: 'Invalid Appointment ID format' });
            }

            const dbInstance = await connectDB();

            // Verify appointment exists
            const appointment = await dbInstance.collection('appointments').findOne({
                _id: appointmentObjectId
            });

            if (!appointment) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            // Get diagnoses for this appointment
            const diagnoses = await dbInstance.collection('diagnoses')
                .find({ appointmentId: appointmentObjectId })
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
                assignmentId: diagnosis.assignmentId ? diagnosis.assignmentId.toString() : null,
                appointmentId: diagnosis.appointmentId ? diagnosis.appointmentId.toString() : null,
                diagnosisName: diagnosis.diagnosisName,
                description: diagnosis.description,
                diagnosedBy: diagnosis.diagnosedBy.toString(),
                diagnosedByName: doctorMap[diagnosis.diagnosedBy.toString()] || 'Unknown',
                createdAt: diagnosis.createdAt,
                updatedAt: diagnosis.updatedAt
            }));

            res.status(200).json({
                diagnoses: formattedDiagnoses,
                appointment: {
                    id: appointment._id.toString(),
                    patientId: appointment.patientId.toString(),
                    doctorId: appointment.doctorId.toString(),
                    status: appointment.status
                }
            });

        } catch (error) {
            console.error('Get diagnoses by appointment error:', error);
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

