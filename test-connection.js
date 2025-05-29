require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testConnection() {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('MONGODB_URI environment variable is not set!');
        process.exit(1);
    }

    // Log sanitized connection string for debugging
    const sanitizedUri = uri.replace(/\/\/[^@]+@/, '//****:****@');
    console.log('Attempting to connect with URI format:', sanitizedUri);

    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000
    });
    
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        console.log('Connected successfully to MongoDB!');
        
        // Test database operations
        const db = client.db();
        await db.command({ ping: 1 });
        console.log('Ping successful! Database is responsive.');
        
        const dbName = client.db().databaseName;
        console.log(`Connected to database: ${dbName}`);

        // Try to list collections to verify permissions
        const collections = await db.listCollections().toArray();
        console.log(`Found ${collections.length} collections`);

    } catch (err) {
        console.error('Error connecting to MongoDB:', {
            name: err.name,
            message: err.message,
            code: err.code,
            stack: err.stack
        });
        
        if (err.message.includes('bad auth')) {
            console.error('Authentication failed. Please check your username and password in the connection string.');
        } else if (err.message.includes('connection timed out')) {
            console.error('Connection timed out. Please check your network settings and MongoDB Atlas Network Access list.');
        }
        
        process.exit(1);
    } finally {
        await client.close();
        console.log('Connection closed.');
    }
}

testConnection().catch(console.error); 