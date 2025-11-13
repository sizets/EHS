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

const billingController = {
    // Create a new charge/billing item
    createCharge: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const {
                patientId,
                assignmentId,
                chargeName,
                amount,
                description,
                chargeType
            } = req.body;

            // Validation
            if (!patientId || !chargeName || !amount) {
                return res.status(400).json({ error: 'Patient ID, Charge Name, and Amount are required' });
            }

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid Patient ID format' });
            }

            if (typeof amount !== 'number' || amount <= 0) {
                return res.status(400).json({ error: 'Amount must be a positive number' });
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

            // Verify assignment exists if provided
            let assignmentObjectId = null;
            if (assignmentId) {
                assignmentObjectId = safeObjectId(assignmentId);
                if (!assignmentObjectId) {
                    return res.status(400).json({ error: 'Invalid Assignment ID format' });
                }

                const assignment = await dbInstance.collection('assignments').findOne({
                    _id: assignmentObjectId
                });
                if (!assignment) {
                    return res.status(404).json({ error: 'Assignment not found' });
                }
            }

            // Create charge
            const charge = {
                patientId: patientObjectId,
                assignmentId: assignmentObjectId,
                chargeName: chargeName.trim(),
                amount: amount,
                description: description?.trim() || '',
                chargeType: chargeType?.trim() || 'general',
                status: 'pending', // pending, paid, cancelled
                createdBy: req.user ? req.user.id : null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('charges').insertOne(charge);

            res.status(201).json({
                message: 'Charge created successfully',
                charge: {
                    id: result.insertedId.toString(),
                    ...charge,
                    patientId: charge.patientId.toString(),
                    assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null
                }
            });

        } catch (error) {
            console.error('Create charge error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all charges for a patient
    getChargesByPatient: async (req, res) => {
        try {
            const { patientId } = req.params;

            const patientObjectId = safeObjectId(patientId);
            if (!patientObjectId) {
                return res.status(400).json({ error: 'Invalid patient ID format' });
            }

            const dbInstance = await connectDB();

            const charges = await dbInstance.collection('charges')
                .find({ patientId: patientObjectId })
                .sort({ createdAt: -1 })
                .toArray();

            const formattedCharges = charges.map(charge => ({
                id: charge._id.toString(),
                patientId: charge.patientId.toString(),
                assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null,
                chargeName: charge.chargeName,
                amount: charge.amount,
                description: charge.description,
                chargeType: charge.chargeType,
                status: charge.status,
                createdBy: charge.createdBy,
                createdAt: charge.createdAt,
                updatedAt: charge.updatedAt
            }));

            res.json({ charges: formattedCharges });
        } catch (error) {
            console.error('Get charges by patient error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all charges for an assignment
    getChargesByAssignment: async (req, res) => {
        try {
            const { assignmentId } = req.params;

            const assignmentObjectId = safeObjectId(assignmentId);
            if (!assignmentObjectId) {
                return res.status(400).json({ error: 'Invalid assignment ID format' });
            }

            const dbInstance = await connectDB();

            const charges = await dbInstance.collection('charges')
                .find({ assignmentId: assignmentObjectId })
                .sort({ createdAt: -1 })
                .toArray();

            const formattedCharges = charges.map(charge => ({
                id: charge._id.toString(),
                patientId: charge.patientId.toString(),
                assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null,
                chargeName: charge.chargeName,
                amount: charge.amount,
                description: charge.description,
                chargeType: charge.chargeType,
                status: charge.status,
                createdBy: charge.createdBy,
                createdAt: charge.createdAt,
                updatedAt: charge.updatedAt
            }));

            res.json({ charges: formattedCharges });
        } catch (error) {
            console.error('Get charges by assignment error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get all charges (Admin only)
    getAllCharges: async (req, res) => {
        try {
            const dbInstance = await connectDB();
            const charges = await dbInstance.collection('charges')
                .find({})
                .sort({ createdAt: -1 })
                .toArray();

            const formattedCharges = charges.map(charge => ({
                id: charge._id.toString(),
                patientId: charge.patientId.toString(),
                assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null,
                chargeName: charge.chargeName,
                amount: charge.amount,
                description: charge.description,
                chargeType: charge.chargeType,
                status: charge.status,
                createdBy: charge.createdBy,
                createdAt: charge.createdAt,
                updatedAt: charge.updatedAt
            }));

            res.json({ charges: formattedCharges });
        } catch (error) {
            console.error('Get all charges error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update charge status
    updateChargeStatus: async (req, res) => {
        try {
            if (!req.body) {
                return res.status(400).json({ error: 'Request body is missing. Please ensure Content-Type is application/json' });
            }

            const { id } = req.params;
            const { status } = req.body;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid charge ID format' });
            }

            // Validate status
            const validStatuses = ['pending', 'paid', 'cancelled'];
            if (!status || !validStatuses.includes(status.toLowerCase())) {
                return res.status(400).json({ error: 'Valid status is required (pending, paid, cancelled)' });
            }

            const dbInstance = await connectDB();

            // Check if charge exists
            const existingCharge = await dbInstance.collection('charges').findOne({
                _id: objectId
            });
            if (!existingCharge) {
                return res.status(404).json({ error: 'Charge not found' });
            }

            // Update charge
            const updateData = {
                status: status.toLowerCase(),
                updatedAt: new Date()
            };

            const result = await dbInstance.collection('charges').updateOne(
                { _id: objectId },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Charge not found' });
            }

            res.json({ message: 'Charge status updated successfully' });

        } catch (error) {
            console.error('Update charge status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete charge
    deleteCharge: async (req, res) => {
        try {
            const { id } = req.params;

            const objectId = safeObjectId(id);
            if (!objectId) {
                return res.status(400).json({ error: 'Invalid charge ID format' });
            }

            const dbInstance = await connectDB();

            // Check if charge exists
            const charge = await dbInstance.collection('charges').findOne({
                _id: objectId
            });
            if (!charge) {
                return res.status(404).json({ error: 'Charge not found' });
            }

            const result = await dbInstance.collection('charges').deleteOne({
                _id: objectId
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Charge not found' });
            }

            res.json({ message: 'Charge deleted successfully' });

        } catch (error) {
            console.error('Delete charge error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = billingController;

