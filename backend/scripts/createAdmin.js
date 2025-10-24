const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

require('dotenv').config();

const createSampleAdmin = async () => {
    try {
        // Connect to MongoDB
        const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('hospitalms');
        const usersCollection = db.collection('users');

        // Check if admin already exists
        const existingAdmin = await usersCollection.findOne({
            email: 'admin@hospitalms.com'
        });

        if (existingAdmin) {
            console.log('⚠️ Admin user already exists');
            console.log('Email: admin@hospitalms.com');
            console.log('Password: admin123');
            await client.close();
            return;
        }

        // Create admin user
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash('admin123', saltRounds);

        const adminUser = {
            name: 'System Administrator',
            email: 'admin@hospitalms.com',
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await usersCollection.insertOne(adminUser);

        console.log('✅ Sample admin user created successfully!');
        console.log('📧 Email: admin@hospitalms.com');
        console.log('🔑 Password: admin123');
        console.log('👤 Role: admin');
        console.log('🆔 User ID:', result.insertedId);

        await client.close();
        console.log('✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    }
};

// Run the script
createSampleAdmin();
