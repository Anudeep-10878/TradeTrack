const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
    origin: '*',  // Allow all origins during development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: true,
    optionsSuccessStatus: 204
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Health check endpoint - respond immediately without waiting for DB
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// MongoDB connection status
let isConnected = false;
let db;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017', {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    ssl: true,
    tls: true,
    tlsAllowInvalidCertificates: false,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000
});

// Connect to MongoDB with retry logic
async function connectToMongo() {
    try {
        console.log("Attempting to connect to MongoDB...");
        console.log("MongoDB URI configured:", process.env.MONGODB_URI ? "Yes" : "No");
        
        await client.connect();
        db = client.db("tradetrack");
        console.log("Connected to MongoDB!");
        
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        isConnected = true;
        return true;
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        console.error("Error details:", {
            name: err.name,
            message: err.message,
            stack: err.stack
        });
        isConnected = false;
        return false;
    }
}

// MongoDB connection status endpoint
app.get('/status', (req, res) => {
    res.json({
        server: 'running',
        mongodb: isConnected ? 'connected' : 'disconnected',
        mongodbUri: process.env.MONGODB_URI ? 'configured' : 'missing',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Middleware to check DB connection
const checkDbConnection = (req, res, next) => {
    if (!isConnected) {
        return res.status(503).json({ error: 'Database connection not available' });
    }
    next();
};

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

// Routes - all API routes use checkDbConnection middleware
app.post('/api/user', checkDbConnection, async (req, res) => {
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

app.get('/api/user/:email', checkDbConnection, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error in GET /api/user/:email:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/trade/:email', checkDbConnection, async (req, res) => {
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
        console.error('Error in POST /api/trade/:email:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server and connect to MongoDB
const PORT = process.env.PORT || 3000;

// Initialize server
async function startServer() {
    console.log('Starting server initialization...');
    
    // First attempt to connect to MongoDB
    const connected = await connectToMongo();
    if (!connected) {
        console.log('Initial MongoDB connection failed, will retry in background');
        // Start retry process in background
        setInterval(async () => {
            if (!isConnected) {
                await connectToMongo();
            }
        }, 5000);
    }
    
    // Start the server regardless of MongoDB connection status
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`MongoDB connection status: ${isConnected ? 'Connected' : 'Not connected'}`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
}); 