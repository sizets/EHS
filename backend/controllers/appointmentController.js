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

const appointmentController = {
    // Create new appointment (patient can create their own)
    createAppointment: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const {
                patientId,
                doctorId,
                appointmentDate,
                appointmentTime,
                symptoms,
                notes,
                department
            } = req.body;

            // Validation
            if (!patientId || !doctorId || !appointmentDate || !appointmentTime) {
                return res.status(400).json({ error: 'Patient ID, Doctor ID, Appointment Date, and Appointment Time are required' });
            }

            // Safely convert IDs to ObjectIds
            const patientObjectId = safeObjectId(patientId);
            const doctorObjectId = safeObjectId(doctorId);

            if (!patientObjectId || !doctorObjectId) {
                return res.status(400).json({ error: 'Invalid Patient or Doctor ID format' });
            }

            // Validate date and time
            const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
            if (isNaN(appointmentDateTime.getTime())) {
                return res.status(400).json({ error: 'Invalid appointment date or time format' });
            }

            // Check if appointment is in the past
            if (appointmentDateTime < new Date()) {
                return res.status(400).json({ error: 'Cannot book appointments in the past' });
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

            // If user is a patient, ensure they can only create appointments for themselves
            if (req.user.role === 'patient') {
                const userPatientId = safeObjectId(req.user.id);
                if (!userPatientId || userPatientId.toString() !== patientObjectId.toString()) {
                    return res.status(403).json({ error: 'You can only create appointments for yourself' });
                }
            }

            // Verify doctor exists
            const doctor = await dbInstance.collection('users').findOne({
                _id: doctorObjectId,
                role: 'doctor'
            });
            if (!doctor) {
                return res.status(404).json({ error: 'Doctor not found' });
            }

            // Check if doctor has a conflicting appointment at the same time
            const conflictingAppointment = await dbInstance.collection('appointments').findOne({
                doctorId: doctorObjectId,
                appointmentDate: appointmentDate,
                appointmentTime: appointmentTime,
                status: { $in: ['scheduled', 'confirmed'] }
            });

            if (conflictingAppointment) {
                return res.status(409).json({
                    error: 'Doctor already has an appointment at this time',
                    conflictingAppointment: {
                        id: conflictingAppointment._id,
                        appointmentDate: conflictingAppointment.appointmentDate,
                        appointmentTime: conflictingAppointment.appointmentTime
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

            // Create appointment
            const appointment = {
                patientId: patientObjectId,
                doctorId: doctorObjectId,
                appointmentDate: appointmentDate,
                appointmentTime: appointmentTime,
                appointmentDateTime: appointmentDateTime,
                symptoms: symptoms?.trim() || '',
                notes: notes?.trim() || '',
                department: departmentId,
                status: 'scheduled',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('appointments').insertOne(appointment);

            res.status(201).json({
                message: 'Appointment created successfully',
                appointment: {
                    id: result.insertedId.toString(),
                    ...appointment,
                    patientId: appointment.patientId.toString(),
                    doctorId: appointment.doctorId.toString()
                }
            });

        } catch (error) {
            console.error('Create appointment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all appointments (Admin only)
    getAllAppointments: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const appointments = await dbInstance.collection('appointments')
                .find({})
                .sort({ appointmentDateTime: 1 })
                .toArray();

            // Get unique patient and doctor IDs
            const patientIds = [...new Set(appointments.map(a => a.patientId))];
            const doctorIds = [...new Set(appointments.map(a => a.doctorId))];
            const departmentIds = [...new Set(appointments.map(a => a.department).filter(Boolean))];

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

            // Format appointments with resolved names
            const formattedAppointments = appointments.map(appointment => ({
                id: appointment._id.toString(),
                patientId: appointment.patientId.toString(),
                doctorId: appointment.doctorId.toString(),
                patientName: patientMap[appointment.patientId.toString()] || 'Unknown Patient',
                doctorName: doctorMap[appointment.doctorId.toString()] || 'Unknown Doctor',
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                appointmentDateTime: appointment.appointmentDateTime,
                symptoms: appointment.symptoms,
                notes: appointment.notes,
                department: appointment.department ? departmentMap[appointment.department.toString()] || 'Unknown' : 'Not assigned',
                departmentId: appointment.department ? appointment.department.toString() : null,
                status: appointment.status,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt
            }));

            res.json({ appointments: formattedAppointments });
        } catch (error) {
            console.error('Get all appointments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get appointment by ID
    getAppointmentById: async (req, res) => {
        try {
            const { id } = req.params;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid appointment ID format' });
            }

            const dbInstance = await connectDB();
            const appointment = await dbInstance.collection('appointments').findOne({
                _id: objectId
            });

            if (!appointment) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            // Get patient and doctor names
            const [patient, doctor] = await Promise.all([
                dbInstance.collection('users').findOne({ _id: appointment.patientId }),
                dbInstance.collection('users').findOne({ _id: appointment.doctorId })
            ]);

            res.json({
                appointment: {
                    id: appointment._id.toString(),
                    patientId: appointment.patientId.toString(),
                    doctorId: appointment.doctorId.toString(),
                    patientName: patient ? patient.name : 'Unknown Patient',
                    doctorName: doctor ? doctor.name : 'Unknown Doctor',
                    appointmentDate: appointment.appointmentDate,
                    appointmentTime: appointment.appointmentTime,
                    appointmentDateTime: appointment.appointmentDateTime,
                    symptoms: appointment.symptoms,
                    notes: appointment.notes,
                    department: appointment.department,
                    status: appointment.status,
                    createdAt: appointment.createdAt,
                    updatedAt: appointment.updatedAt
                }
            });
        } catch (error) {
            console.error('Get appointment by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update appointment status
    updateAppointmentStatus: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { status, notes } = req.body;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid appointment ID format' });
            }

            // Validate status
            const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled'];
            if (!status || !validStatuses.includes(status.toLowerCase())) {
                return res.status(400).json({ error: 'Valid status is required (scheduled, confirmed, completed, cancelled)' });
            }

            const dbInstance = await connectDB();

            // Check if appointment exists
            const existingAppointment = await dbInstance.collection('appointments').findOne({
                _id: objectId
            });
            if (!existingAppointment) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            // Update appointment
            const updateData = {
                status: status.toLowerCase(),
                updatedAt: new Date()
            };

            if (notes) {
                updateData.notes = notes.trim();
            }

            const result = await dbInstance.collection('appointments').updateOne(
                { _id: objectId },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json({ message: 'Appointment status updated successfully' });

        } catch (error) {
            console.error('Update appointment status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get appointments by patient ID
    getAppointmentsByPatient: async (req, res) => {
        try {
            const { patientId } = req.params;

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid patient ID format' });
            }

            const dbInstance = await connectDB();
            const appointments = await dbInstance.collection('appointments')
                .find({ patientId: patientObjectId })
                .sort({ appointmentDateTime: 1 })
                .toArray();

            // Get doctor and department info
            const doctorIds = [...new Set(appointments.map(a => a.doctorId))];
            const departmentIds = [...new Set(appointments.map(a => a.department).filter(Boolean))];

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

            const formattedAppointments = appointments.map(appointment => ({
                id: appointment._id.toString(),
                patientId: appointment.patientId.toString(),
                doctorId: appointment.doctorId.toString(),
                doctorName: doctorMap[appointment.doctorId.toString()] || 'Unknown Doctor',
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                appointmentDateTime: appointment.appointmentDateTime,
                symptoms: appointment.symptoms,
                notes: appointment.notes,
                department: appointment.department ? (departmentMap[appointment.department.toString()] || 'Unknown') : 'Not assigned',
                departmentId: appointment.department ? appointment.department.toString() : null,
                status: appointment.status,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt
            }));

            res.json({ appointments: formattedAppointments });
        } catch (error) {
            console.error('Get appointments by patient error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get appointments by doctor ID
    getAppointmentsByDoctor: async (req, res) => {
        try {
            const { doctorId } = req.params;

            const doctorObjectId = safeObjectId(doctorId);
            if (!doctorObjectId) {
                return res.status(400).json({ error: 'Invalid doctor ID format' });
            }

            const dbInstance = await connectDB();
            const appointments = await dbInstance.collection('appointments')
                .find({ doctorId: doctorObjectId })
                .sort({ appointmentDateTime: 1 })
                .toArray();

            // Get patient and department info
            const patientIds = [...new Set(appointments.map(a => a.patientId))];
            const departmentIds = [...new Set(appointments.map(a => a.department).filter(Boolean))];

            const [patients, doctor, departments] = await Promise.all([
                dbInstance.collection('users').find({ _id: { $in: patientIds } }).toArray(),
                dbInstance.collection('users').findOne({ _id: doctorObjectId }),
                dbInstance.collection('departments').find({ _id: { $in: departmentIds } }).toArray()
            ]);

            const patientMap = {};
            patients.forEach(patient => {
                patientMap[patient._id.toString()] = patient.name;
            });

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            const formattedAppointments = appointments.map(appointment => ({
                id: appointment._id.toString(),
                patientId: appointment.patientId.toString(),
                doctorId: appointment.doctorId.toString(),
                patientName: patientMap[appointment.patientId.toString()] || 'Unknown Patient',
                doctorName: doctor ? doctor.name : 'Unknown Doctor',
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                appointmentDateTime: appointment.appointmentDateTime,
                symptoms: appointment.symptoms,
                notes: appointment.notes,
                department: appointment.department ? departmentMap[appointment.department.toString()] || 'Unknown' : 'Not assigned',
                departmentId: appointment.department ? appointment.department.toString() : null,
                status: appointment.status,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt
            }));

            res.json({ appointments: formattedAppointments });
        } catch (error) {
            console.error('Get appointments by doctor error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get available doctors for appointments (all doctors, not just emergency)
    getAvailableDoctors: async (req, res) => {
        try {
            const { date, time } = req.query;
            const dbInstance = await connectDB();

            // Get all doctors (not just emergency)
            const allDoctors = await dbInstance.collection('users').find({
                role: 'doctor'
            }).toArray();

            if (allDoctors.length === 0) {
                return res.json({ doctors: [] });
            }

            // If date and time are provided, filter out doctors with conflicting appointments
            let availableDoctors = allDoctors;
            if (date && time) {
                const doctorIds = allDoctors.map(doctor => doctor._id);

                // Find doctors who have appointments at this time
                const conflictingAppointments = await dbInstance.collection('appointments').find({
                    doctorId: { $in: doctorIds },
                    appointmentDate: date,
                    appointmentTime: time,
                    status: { $in: ['scheduled', 'confirmed'] }
                }).toArray();

                // Get IDs of busy doctors
                const busyDoctorIds = conflictingAppointments.map(apt => apt.doctorId);

                // Filter out busy doctors
                availableDoctors = allDoctors.filter(doctor =>
                    !busyDoctorIds.some(busyId => busyId.toString() === doctor._id.toString())
                );
            }

            // Get department info
            const departmentIds = [...new Set(availableDoctors.map(d => d.department).filter(Boolean))];
            const departments = await dbInstance.collection('departments')
                .find({ _id: { $in: departmentIds } })
                .toArray();

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            // Format response
            const formattedDoctors = availableDoctors.map(doctor => ({
                id: doctor._id.toString(),
                name: doctor.name,
                email: doctor.email,
                specialization: doctor.specialization || '',
                department: doctor.department ? (departmentMap[doctor.department.toString()] || 'Unknown') : 'Not assigned',
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

    // Delete appointment
    deleteAppointment: async (req, res) => {
        try {
            const { id } = req.params;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid appointment ID format' });
            }

            const dbInstance = await connectDB();

            // Check if appointment exists
            const appointment = await dbInstance.collection('appointments').findOne({
                _id: objectId
            });
            if (!appointment) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            const result = await dbInstance.collection('appointments').deleteOne({
                _id: objectId
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json({ message: 'Appointment deleted successfully' });

        } catch (error) {
            console.error('Delete appointment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get appointments for the current patient (patient-specific)
    getMyAppointments: async (req, res) => {
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
                return res.status(403).json({ error: 'Access denied. Only patients can view their appointments.' });
            }

            const appointments = await dbInstance.collection('appointments')
                .find({ patientId: patientObjectId })
                .sort({ appointmentDateTime: 1 })
                .toArray();

            // Collect referenced doctor and department IDs
            const doctorIds = [...new Set(appointments.map(a => a.doctorId))];
            const departmentIds = [...new Set(appointments.map(a => a.department).filter(Boolean))];

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

            const formattedAppointments = appointments.map(appointment => ({
                id: appointment._id.toString(),
                patientId: appointment.patientId.toString(),
                doctorId: appointment.doctorId.toString(),
                doctorName: doctorMap[appointment.doctorId.toString()] || 'Unknown Doctor',
                department: appointment.department ? (departmentMap[appointment.department.toString()] || 'Unknown') : 'Not assigned',
                departmentId: appointment.department ? appointment.department.toString() : null,
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                appointmentDateTime: appointment.appointmentDateTime,
                symptoms: appointment.symptoms,
                notes: appointment.notes,
                status: appointment.status,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt
            }));

            res.json({ appointments: formattedAppointments });
        } catch (error) {
            console.error('Get my appointments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get appointments for the current doctor (doctor-specific)
    getMyAppointmentsDoctor: async (req, res) => {
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
                return res.status(403).json({ error: 'Access denied. Only doctors can view their appointments.' });
            }

            const appointments = await dbInstance.collection('appointments')
                .find({ doctorId: doctorObjectId })
                .sort({ appointmentDateTime: 1 })
                .toArray();

            // Get unique patient IDs and department IDs
            const patientIds = [...new Set(appointments.map(a => a.patientId))];
            const departmentIds = [...new Set(appointments.map(a => a.department).filter(Boolean))];

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

            const formattedAppointments = appointments.map(appointment => ({
                id: appointment._id.toString(),
                patientId: appointment.patientId.toString(),
                doctorId: appointment.doctorId.toString(),
                patientName: patientMap[appointment.patientId.toString()] || 'Unknown Patient',
                doctorName: doctor.name, // Current doctor's name
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
                appointmentDateTime: appointment.appointmentDateTime,
                symptoms: appointment.symptoms,
                notes: appointment.notes,
                department: appointment.department ? departmentMap[appointment.department.toString()] || 'Unknown' : 'Not assigned',
                departmentId: appointment.department ? appointment.department.toString() : null,
                status: appointment.status,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt
            }));

            res.json({ appointments: formattedAppointments });
        } catch (error) {
            console.error('Get my appointments (doctor) error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = appointmentController;

