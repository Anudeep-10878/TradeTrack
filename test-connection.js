require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testConnection() {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('MONGODB_URI environment variable is not set!');
        process.exit(1);
    }

    const client = new MongoClient(uri, {
        tls: true,
        tlsAllowInvalidCertificates: true,
        tlsInsecure: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000
    });
    
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        console.log('Connected successfully to MongoDB!');
        
        await client.db().command({ ping: 1 });
        console.log('Ping successful! Database is responsive.');
        
        const dbName = client.db().databaseName;
        console.log(`Connected to database: ${dbName}`);
    } catch (err) {
        console.error('Error connecting to MongoDB:', {
            name: err.name,
            message: err.message,
            stack: err.stack
        });
        process.exit(1);
    } finally {
        await client.close();
        console.log('Connection closed.');
    }
}

testConnection().catch(console.error); 