const mongoose = require('mongoose');

console.log('🔍 Checking MongoDB Connection...\n');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/FindLove', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', (error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure MongoDB is installed and running');
    console.log('2. Check if MongoDB service is started');
    console.log('3. Try connecting to mongodb://localhost:27017 in MongoDB Compass');
    process.exit(1);
});

db.once('open', async () => {
    console.log('✅ Connected to MongoDB successfully!');
    console.log(`📊 Database: ${db.name}`);
    console.log(`🔗 Connection: mongodb://localhost:27017/${db.name}`);
    
    try {
        // List all collections
        const collections = await db.db.listCollections().toArray();
        console.log(`📁 Collections: ${collections.map(c => c.name).join(', ') || 'None yet'}`);
        
        // Check if users collection exists and count documents
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const userCount = await User.countDocuments();
        console.log(`👥 Users in database: ${userCount}`);
        
        if (userCount > 0) {
            console.log('\n📋 Sample users:');
            const sampleUsers = await User.find({}).limit(3);
            sampleUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.fullName || 'No name'} (${user.email || 'No email'})`);
            });
        }
        
        console.log('\n🎯 To view your data:');
        console.log('1. Open MongoDB Compass');
        console.log('2. Connect to: mongodb://localhost:27017');
        console.log('3. Look for database: FindLove');
        console.log('4. Click on collection: users');
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
    }
    
    mongoose.connection.close();
    console.log('\n✅ Check complete!');
});
