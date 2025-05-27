const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
    origin: ['https://tradetrack-journal.netlify.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// MongoDB connection status
let isConnected = false;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;

// Connect to MongoDB with retry logic
async function connectToMongo() {
    try {
        console.log("Attempting to connect to MongoDB...");
        await client.connect();
        db = client.db("tradetrack"); // specify your database name
        console.log("Connected to MongoDB!");
        
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        isConnected = true;
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        isConnected = false;
        console.log("Retrying in 5 seconds...");
        setTimeout(connectToMongo, 5000);
    }
}

connectToMongo();

// MongoDB connection status endpoint
app.get('/status', (req, res) => {
    res.json({
        server: 'running',
        mongodb: isConnected ? 'connected' : 'disconnected',
        mongodbUri: process.env.MONGODB_URI ? 'configured' : 'missing'
    });
});

// User Schema and Model (using native MongoDB driver)
async function createUser(userData) {
    if (!isConnected) {
        throw new Error('Database not connected');
    }
    
    try {
        const result = await db.collection('users').findOneAndUpdate(
            { email: userData.email },
            { $setOnInsert: { 
                ...userData,
                trades: [],
                metrics: {
                    total_trades: 0,
                    winning_trades: 0,
                    total_profit_loss: 0,
                    win_rate: 0,
                    average_return: 0
                }
            }},
            { upsert: true, returnDocument: 'after' }
        );
        return result;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Routes
app.post('/api/user', async (req, res) => {
    try {
        console.log('Received user creation request:', req.body);
        const { email, name, picture } = req.body;
        
        if (!email || !name) {
            return res.status(400).json({ error: 'Email and name are required' });
        }
        
        const result = await createUser({ email, name, picture });
        console.log('User created/updated successfully');
        res.json(result.value);
    } catch (error) {
        console.error('Error in POST /api/user:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/:email', async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/trade/:email', async (req, res) => {
    try {
        const trade = req.body;
        const result = await db.collection('users').findOneAndUpdate(
            { email: req.params.email },
            { 
                $push: { trades: trade },
                $inc: {
                    'metrics.total_trades': 1,
                    'metrics.winning_trades': trade.profit_loss > 0 ? 1 : 0,
                    'metrics.total_profit_loss': trade.profit_loss
                }
            },
            { returnDocument: 'after' }
        );

        if (!result.value) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update win rate and average return
        const user = result.value;
        const winRate = (user.metrics.winning_trades / user.metrics.total_trades) * 100;
        const avgReturn = user.metrics.total_profit_loss / user.metrics.total_trades;

        await db.collection('users').updateOne(
            { email: req.params.email },
            { 
                $set: {
                    'metrics.win_rate': winRate,
                    'metrics.average_return': avgReturn
                }
            }
        );

        user.metrics.win_rate = winRate;
        user.metrics.average_return = avgReturn;

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 