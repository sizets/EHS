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

const testController = {
    // Get all tests for a specific patient
    getTestsByPatient: async (req, res) => {
        try {
            const { patientId } = req.params;

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid Patient ID format' });
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

            // Get all tests for this patient
            const tests = await dbInstance.collection('tests')
                .find({ patientId: patientObjectId })
                .sort({ testDate: -1 })
                .toArray();

            // Format tests
            const formattedTests = tests.map(test => ({
                id: test._id.toString(),
                patientId: test.patientId.toString(),
                testName: test.testName,
                testType: test.testType || '',
                testDate: test.testDate,
                result: test.result || '',
                status: test.status || 'pending', // pending, completed, abnormal
                orderedBy: test.orderedBy ? test.orderedBy.toString() : null,
                notes: test.notes || '',
                createdAt: test.createdAt,
                updatedAt: test.updatedAt
            }));

            res.status(200).json({
                tests: formattedTests,
                patient: {
                    id: patient._id.toString(),
                    name: patient.name,
                    email: patient.email
                }
            });

        } catch (error) {
            console.error('Get tests by patient error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all tests
    getAllTests: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const tests = await dbInstance.collection('tests')
                .find({})
                .sort({ testDate: -1 })
                .toArray();

            // Get unique patient and doctor IDs
            const patientIds = [...new Set(tests.map(t => t.patientId))];
            const doctorIds = [...new Set(tests.map(t => t.orderedBy).filter(Boolean))];

            // Fetch patients and doctors
            const [patients, doctors] = await Promise.all([
                dbInstance.collection('users').find({ _id: { $in: patientIds } }).toArray(),
                dbInstance.collection('users').find({ _id: { $in: doctorIds } }).toArray()
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

            // Format tests
            const formattedTests = tests.map(test => ({
                id: test._id.toString(),
                patientId: test.patientId.toString(),
                patientName: patientMap[test.patientId.toString()] || 'Unknown',
                testName: test.testName,
                testType: test.testType || '',
                testDate: test.testDate,
                result: test.result || '',
                status: test.status || 'pending',
                orderedBy: test.orderedBy ? test.orderedBy.toString() : null,
                orderedByName: test.orderedBy ? (doctorMap[test.orderedBy.toString()] || 'Unknown') : null,
                notes: test.notes || '',
                createdAt: test.createdAt,
                updatedAt: test.updatedAt
            }));

            res.status(200).json({
                tests: formattedTests
            });

        } catch (error) {
            console.error('Get all tests error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create a new test
    createTest: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { patientId, testName, testType, testDate, result, status, notes } = req.body;

            // Validation
            if (!patientId || !testName) {
                return res.status(400).json({ error: 'Patient ID and Test Name are required' });
            }

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid Patient ID format' });
            }

            if (testName.trim().length < 2) {
                return res.status(400).json({ error: 'Test name must be at least 2 characters long' });
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

            // Get doctor/admin ID who is creating the test
            const orderedBy = req.user ? safeObjectId(req.user.id) : null;

            // Create test
            const test = {
                patientId: patientObjectId,
                testName: testName.trim(),
                testType: testType?.trim() || '',
                testDate: testDate ? new Date(testDate) : new Date(),
                result: result?.trim() || '',
                status: status || 'pending', // pending, completed, abnormal
                orderedBy: orderedBy,
                notes: notes?.trim() || '',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result_db = await dbInstance.collection('tests').insertOne(test);

            // Format response
            const createdTest = {
                id: result_db.insertedId.toString(),
                patientId: patientObjectId.toString(),
                patientName: patient.name,
                testName: test.testName,
                testType: test.testType,
                testDate: test.testDate,
                result: test.result,
                status: test.status,
                orderedBy: orderedBy ? orderedBy.toString() : null,
                notes: test.notes,
                createdAt: test.createdAt
            };

            res.status(201).json({
                message: 'Test created successfully',
                test: createdTest
            });

        } catch (error) {
            console.error('Create test error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get test by ID
    getTestById: async (req, res) => {
        try {
            const { id } = req.params;

            const testObjectId = safeObjectId(id);
            if (!testObjectId) {
                return res.status(400).json({ error: 'Invalid Test ID format' });
            }

            const dbInstance = await connectDB();
            const test = await dbInstance.collection('tests').findOne({
                _id: testObjectId
            });

            if (!test) {
                return res.status(404).json({ error: 'Test not found' });
            }

            // Get patient and doctor details
            const [patient, doctor] = await Promise.all([
                dbInstance.collection('users').findOne({ _id: test.patientId }),
                test.orderedBy ? dbInstance.collection('users').findOne({ _id: test.orderedBy }) : null
            ]);

            const formattedTest = {
                id: test._id.toString(),
                patientId: test.patientId.toString(),
                patientName: patient ? patient.name : 'Unknown',
                testName: test.testName,
                testType: test.testType || '',
                testDate: test.testDate,
                result: test.result || '',
                status: test.status || 'pending',
                orderedBy: test.orderedBy ? test.orderedBy.toString() : null,
                orderedByName: doctor ? doctor.name : null,
                notes: test.notes || '',
                createdAt: test.createdAt,
                updatedAt: test.updatedAt
            };

            res.status(200).json({
                test: formattedTest
            });

        } catch (error) {
            console.error('Get test by ID error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update test
    updateTest: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { testName, testType, testDate, result, status, notes } = req.body;

            const testObjectId = safeObjectId(id);
            if (!testObjectId) {
                return res.status(400).json({ error: 'Invalid Test ID format' });
            }

            const dbInstance = await connectDB();

            // Find test
            const test = await dbInstance.collection('tests').findOne({
                _id: testObjectId
            });

            if (!test) {
                return res.status(404).json({ error: 'Test not found' });
            }

            // Prepare update data
            const updateData = {
                updatedAt: new Date()
            };

            if (testName !== undefined) {
                if (testName.trim().length < 2) {
                    return res.status(400).json({ error: 'Test name must be at least 2 characters long' });
                }
                updateData.testName = testName.trim();
            }

            if (testType !== undefined) updateData.testType = testType.trim();
            if (testDate !== undefined) updateData.testDate = new Date(testDate);
            if (result !== undefined) updateData.result = result.trim();
            if (status !== undefined) updateData.status = status;
            if (notes !== undefined) updateData.notes = notes.trim();

            // Update test
            await dbInstance.collection('tests').updateOne(
                { _id: testObjectId },
                { $set: updateData }
            );

            // Get updated test
            const updatedTest = await dbInstance.collection('tests').findOne({
                _id: testObjectId
            });

            // Get patient and doctor details
            const [patient, doctor] = await Promise.all([
                dbInstance.collection('users').findOne({ _id: updatedTest.patientId }),
                updatedTest.orderedBy ? dbInstance.collection('users').findOne({ _id: updatedTest.orderedBy }) : null
            ]);

            const formattedTest = {
                id: updatedTest._id.toString(),
                patientId: updatedTest.patientId.toString(),
                patientName: patient ? patient.name : 'Unknown',
                testName: updatedTest.testName,
                testType: updatedTest.testType || '',
                testDate: updatedTest.testDate,
                result: updatedTest.result || '',
                status: updatedTest.status || 'pending',
                orderedBy: updatedTest.orderedBy ? updatedTest.orderedBy.toString() : null,
                orderedByName: doctor ? doctor.name : null,
                notes: updatedTest.notes || '',
                createdAt: updatedTest.createdAt,
                updatedAt: updatedTest.updatedAt
            };

            res.status(200).json({
                message: 'Test updated successfully',
                test: formattedTest
            });

        } catch (error) {
            console.error('Update test error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete test
    deleteTest: async (req, res) => {
        try {
            const { id } = req.params;

            const testObjectId = safeObjectId(id);
            if (!testObjectId) {
                return res.status(400).json({ error: 'Invalid Test ID format' });
            }

            const dbInstance = await connectDB();

            // Find test
            const test = await dbInstance.collection('tests').findOne({
                _id: testObjectId
            });

            if (!test) {
                return res.status(404).json({ error: 'Test not found' });
            }

            // Delete test
            await dbInstance.collection('tests').deleteOne({
                _id: testObjectId
            });

            res.status(200).json({
                message: 'Test deleted successfully'
            });

        } catch (error) {
            console.error('Delete test error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = testController;

