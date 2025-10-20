const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const createInitialDepartments = async () => {
    try {
        // Connect to MongoDB
        const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('hospitalms');
        const departmentsCollection = db.collection('departments');

        // Check if departments already exist
        const existingDepartments = await departmentsCollection.countDocuments();
        if (existingDepartments > 0) {
            console.log('⚠️ Departments already exist, skipping creation');
            await client.close();
            return;
        }

        // Create initial departments
        const initialDepartments = [
            {
                name: 'Cardiology',
                description: 'Heart and cardiovascular system care',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Emergency Medicine',
                description: 'Emergency and urgent care services',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Surgery',
                description: 'Surgical procedures and operations',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Pediatrics',
                description: 'Medical care for infants, children, and adolescents',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Orthopedics',
                description: 'Musculoskeletal system and joint care',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Neurology',
                description: 'Nervous system and brain disorders',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Radiology',
                description: 'Medical imaging and diagnostic services',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Internal Medicine',
                description: 'Adult medicine and chronic disease management',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        const result = await departmentsCollection.insertMany(initialDepartments);

        console.log('✅ Initial departments created successfully!');
        console.log(`📊 Created ${result.insertedCount} departments:`);
        initialDepartments.forEach((dept, index) => {
            console.log(`   ${index + 1}. ${dept.name} - ${dept.description}`);
        });

        await client.close();
        console.log('✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error creating initial departments:', error);
        process.exit(1);
    }
};

// Run the script
createInitialDepartments();
