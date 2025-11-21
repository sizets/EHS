const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
                appointmentId,
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

            // Verify appointment exists if provided
            let appointmentObjectId = null;
            if (appointmentId) {
                appointmentObjectId = safeObjectId(appointmentId);
                if (!appointmentObjectId) {
                    return res.status(400).json({ error: 'Invalid Appointment ID format' });
                }

                const appointment = await dbInstance.collection('appointments').findOne({
                    _id: appointmentObjectId
                });
                if (!appointment) {
                    return res.status(404).json({ error: 'Appointment not found' });
                }
            }

            // Create charge
            const charge = {
                patientId: patientObjectId,
                assignmentId: assignmentObjectId,
                appointmentId: appointmentObjectId,
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
                    assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null,
                    appointmentId: charge.appointmentId ? charge.appointmentId.toString() : null
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
                appointmentId: charge.appointmentId ? charge.appointmentId.toString() : null,
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

    // Get charges for the current patient (patient-specific)
    getMyCharges: async (req, res) => {
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
                return res.status(403).json({ error: 'Access denied. Only patients can view their charges.' });
            }

            const charges = await dbInstance.collection('charges')
                .find({ patientId: patientObjectId })
                .sort({ createdAt: -1 })
                .toArray();

            const formattedCharges = charges.map(charge => ({
                id: charge._id.toString(),
                patientId: charge.patientId.toString(),
                assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null,
                appointmentId: charge.appointmentId ? charge.appointmentId.toString() : null,
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
            console.error('Get my charges error:', error);
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
                appointmentId: charge.appointmentId ? charge.appointmentId.toString() : null,
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

    // Get all charges for an appointment
    getChargesByAppointment: async (req, res) => {
        try {
            const { appointmentId } = req.params;

            const appointmentObjectId = safeObjectId(appointmentId);
            if (!appointmentObjectId) {
                return res.status(400).json({ error: 'Invalid appointment ID format' });
            }

            const dbInstance = await connectDB();

            const charges = await dbInstance.collection('charges')
                .find({ appointmentId: appointmentObjectId })
                .sort({ createdAt: -1 })
                .toArray();

            const formattedCharges = charges.map(charge => ({
                id: charge._id.toString(),
                patientId: charge.patientId.toString(),
                assignmentId: charge.assignmentId ? charge.assignmentId.toString() : null,
                appointmentId: charge.appointmentId ? charge.appointmentId.toString() : null,
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
            console.error('Get charges by appointment error:', error);
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
                appointmentId: charge.appointmentId ? charge.appointmentId.toString() : null,
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
    },

    // Create Stripe Checkout Session
    createCheckoutSession: async (req, res) => {
        try {
            const { chargeId } = req.body;

            if (!chargeId) {
                return res.status(400).json({ error: 'Charge ID is required' });
            }

            const chargeObjectId = safeObjectId(chargeId);
            if (!chargeObjectId) {
                return res.status(400).json({ error: 'Invalid charge ID format' });
            }

            const dbInstance = await connectDB();

            // Get the charge
            const charge = await dbInstance.collection('charges').findOne({
                _id: chargeObjectId
            });

            if (!charge) {
                return res.status(404).json({ error: 'Charge not found' });
            }

            // Verify the charge belongs to the authenticated patient
            if (req.user.role === 'patient' && charge.patientId.toString() !== req.user.id) {
                return res.status(403).json({ error: 'Access denied. This charge does not belong to you.' });
            }

            // Check if charge is already paid
            if (charge.status === 'paid') {
                return res.status(400).json({ error: 'This charge has already been paid' });
            }

            if (charge.status === 'cancelled') {
                return res.status(400).json({ error: 'This charge has been cancelled' });
            }

            // Get patient information
            const patient = await dbInstance.collection('users').findOne({
                _id: charge.patientId
            });

            if (!patient) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            // Create Stripe Checkout Session
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: charge.chargeName,
                                description: charge.description || 'Medical charge',
                            },
                            unit_amount: Math.round(charge.amount * 100), // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${baseUrl}/my-bills?payment=success&chargeId=${chargeId}`,
                cancel_url: `${baseUrl}/my-bills?payment=cancelled&chargeId=${chargeId}`,
                client_reference_id: chargeId,
                customer_email: patient.email,
                metadata: {
                    chargeId: chargeId,
                    patientId: charge.patientId.toString(),
                },
            });

            res.json({ 
                sessionId: session.id,
                url: session.url 
            });

        } catch (error) {
            console.error('Create checkout session error:', error);
            res.status(500).json({ error: 'Internal server error: ' + error.message });
        }
    },

    // Handle payment success (called from frontend after redirect)
    handlePaymentSuccess: async (req, res) => {
        try {
            const { chargeId } = req.query;

            if (!chargeId) {
                return res.status(400).json({ error: 'Charge ID is required' });
            }

            const chargeObjectId = safeObjectId(chargeId);
            if (!chargeObjectId) {
                return res.status(400).json({ error: 'Invalid charge ID format' });
            }

            const dbInstance = await connectDB();

            // Update charge status to paid
            const result = await dbInstance.collection('charges').updateOne(
                { _id: chargeObjectId },
                { 
                    $set: { 
                        status: 'paid',
                        updatedAt: new Date()
                    } 
                }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Charge not found' });
            }

            res.json({ message: 'Payment successful. Charge status updated to paid.' });

        } catch (error) {
            console.error('Handle payment success error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Stripe webhook endpoint (optional, for production use)
    stripeWebhook: async (req, res) => {
        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the checkout.session.completed event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const chargeId = session.metadata?.chargeId;

            if (chargeId) {
                try {
                    const dbInstance = await connectDB();
                    const chargeObjectId = safeObjectId(chargeId);

                    if (chargeObjectId) {
                        await dbInstance.collection('charges').updateOne(
                            { _id: chargeObjectId },
                            { 
                                $set: { 
                                    status: 'paid',
                                    updatedAt: new Date()
                                } 
                            }
                        );
                        console.log(`Charge ${chargeId} marked as paid via webhook`);
                    }
                } catch (error) {
                    console.error('Error updating charge from webhook:', error);
                }
            }
        }

        res.json({ received: true });
    }
};

module.exports = billingController;

