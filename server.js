const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

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
let mongoClient = null;

// MongoDB connection string parsing and configuration
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/tradetrack";

// Log connection string format (without credentials)
const sanitizedUri = uri.replace(/\/\/[^@]+@/, '//****:****@');
console.log('MongoDB Connection String Format:', sanitizedUri);

const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
};

// Connect to MongoDB with retry logic
async function connectToMongo() {
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
        try {
            console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1} of ${maxRetries})...`);
            console.log("Connection options:", JSON.stringify(options, null, 2));
            
            // Close existing connection if any
            if (mongoClient) {
                await mongoClient.close();
                mongoClient = null;
            }
            
            // Create new client
            mongoClient = new MongoClient(uri, options);
            
            // Connect to the client
            await mongoClient.connect();
            console.log("Connected to client!");
            
            // Get database instance
            db = mongoClient.db();
            console.log("Selected database!");
            
            // Test the connection
            await db.command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
            
            // Add event listeners for connection issues
            mongoClient.on('serverClosed', () => {
                console.log('MongoDB server connection closed');
                isConnected = false;
                // Attempt to reconnect
                setTimeout(() => connectToMongo(), 5000);
            });

            mongoClient.on('error', (err) => {
                console.error('MongoDB connection error:', err);
                isConnected = false;
            });
            
            isConnected = true;
            return true;
        } catch (err) {
            console.error(`Error connecting to MongoDB (attempt ${retryCount + 1}):`, {
                name: err.name,
                message: err.message,
                stack: err.stack,
                code: err.code
            });
            
            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`Retrying in 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.error('Max retry attempts reached. Could not connect to MongoDB.');
                isConnected = false;
                return false;
            }
        }
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        if (mongoClient) {
            await mongoClient.close();
            console.log('MongoDB connection closed through app termination');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
    }
});

// MongoDB connection status endpoint
app.get('/status', async (req, res) => {
    try {
        if (!isConnected) {
            // Try to connect if not connected
            await connectToMongo();
        }
        
        res.json({
            server: 'running',
            mongodb: isConnected ? 'connected' : 'disconnected',
            mongodbUri: process.env.MONGODB_URI ? 'configured' : 'missing',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({
            server: 'running',
            mongodb: 'error',
            error: error.message
        });
    }
});

// Middleware to check DB connection
const checkDbConnection = (req, res, next) => {
    if (!isConnected) {
        return res.status(503).json({ error: 'Database connection not available' });
    }
    next();
};

// Function to create initial metrics object
function createInitialMetrics() {
    return {
        total_profit_loss: 0,
        total_trades: 0,
        winning_trades: 0,
        win_rate: 0,
        average_return: 0,
        best_trade: 0,
        worst_trade: 0,
        win_streak: 0,
        current_win_streak: 0
    };
}

// User Schema and Model (using native MongoDB driver)
async function createUser(userData) {
    if (!isConnected) {
        throw new Error('Database not connected');
    }
    
    try {
        // Initialize user data with default metrics
        const userWithDefaults = {
            ...userData,
            trades: [],
            metrics: createInitialMetrics(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('users').findOneAndUpdate(
            { email: userData.email },
            { 
                $setOnInsert: userWithDefaults
            },
            { 
                upsert: true, 
                returnDocument: 'after'
            }
        );

        // If user exists but doesn't have metrics, initialize them
        if (result.value && (!result.value.metrics || result.value.metrics.total_profit_loss === null)) {
            await db.collection('users').updateOne(
                { email: userData.email },
                { 
                    $set: { 
                        metrics: createInitialMetrics(),
                        updatedAt: new Date()
                    }
                }
            );
            return await db.collection('users').findOne({ email: userData.email });
        }

        return result.value;
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

// Function to calculate trade metrics
function calculateTradeMetrics(trades) {
    const metrics = {
        total_profit_loss: 0,
        total_trades: trades.length,
        win_rate: 0,
        average_return: 0,
        best_trade: 0,
        worst_trade: 0,
        win_streak: 0,
        current_win_streak: 0
    };

    let winning_trades = 0;
    let total_return_percentage = 0;

    trades.forEach(trade => {
        // Calculate profit/loss for this trade
        const quantity = trade.quantity || 1;
        const profit_loss = (trade.exitPrice - trade.entryPrice) * quantity;
        trade.profit_loss = profit_loss;

        // Update total P&L
        metrics.total_profit_loss += profit_loss;

        // Calculate return percentage
        const return_percentage = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
        total_return_percentage += return_percentage;

        // Update best and worst trades
        metrics.best_trade = Math.max(metrics.best_trade, profit_loss);
        metrics.worst_trade = Math.min(metrics.worst_trade, profit_loss);

        // Count winning trades and update win streak
        if (profit_loss > 0) {
            winning_trades++;
            metrics.current_win_streak++;
            metrics.win_streak = Math.max(metrics.win_streak, metrics.current_win_streak);
        } else {
            metrics.current_win_streak = 0;
        }
    });

    // Calculate win rate and average return
    metrics.win_rate = (trades.length > 0) ? (winning_trades / trades.length) * 100 : 0;
    metrics.average_return = (trades.length > 0) ? total_return_percentage / trades.length : 0;

    return metrics;
}

// Update the /api/trade/:email POST route
app.post('/api/trade/:email', checkDbConnection, async (req, res) => {
    try {
        console.log('Received trade data:', req.body);
        const tradeData = req.body;
        
        // Calculate profit/loss for this trade
        const quantity = Number(tradeData.quantity) || 1;
        const entryPrice = Number(tradeData.entryPrice);
        const exitPrice = Number(tradeData.exitPrice);
        
        if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(quantity)) {
            return res.status(400).json({ 
                error: 'Invalid price or quantity values',
                details: { entryPrice, exitPrice, quantity }
            });
        }

        const profit_loss = (exitPrice - entryPrice) * quantity;
        tradeData.profit_loss = profit_loss;
        tradeData.timestamp = new Date().toISOString();

        // Find user and ensure metrics exist
        const user = await db.collection('users').findOne({ email: req.params.email });
        
        if (!user) {
            console.error('User not found:', req.params.email);
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize metrics if they don't exist or have null values
        let currentMetrics = user.metrics || {
            total_profit_loss: 0,
            total_trades: 0,
            winning_trades: 0,
            win_rate: 0,
            average_return: 0,
            best_trade: 0,
            worst_trade: 0,
            win_streak: 0,
            current_win_streak: 0
        };

        // Ensure all metric values are numbers
        Object.keys(currentMetrics).forEach(key => {
            if (currentMetrics[key] === null || isNaN(currentMetrics[key])) {
                currentMetrics[key] = 0;
            } else {
                currentMetrics[key] = Number(currentMetrics[key]);
            }
        });

        // Initialize trades array if it doesn't exist
        const trades = Array.isArray(user.trades) ? user.trades : [];
        trades.push(tradeData);

        // Calculate new metrics
        let metrics = {
            total_profit_loss: currentMetrics.total_profit_loss + profit_loss,
            total_trades: trades.length,
            winning_trades: 0,
            win_rate: 0,
            average_return: 0,
            best_trade: Math.max(currentMetrics.best_trade, profit_loss),
            worst_trade: Math.min(currentMetrics.worst_trade, profit_loss),
            win_streak: currentMetrics.win_streak,
            current_win_streak: profit_loss > 0 ? currentMetrics.current_win_streak + 1 : 0
        };

        // Calculate metrics
        let total_return = 0;
        trades.forEach(trade => {
            const tradePL = Number(trade.profit_loss) || 0;
            if (tradePL > 0) {
                metrics.winning_trades++;
            }
            total_return += ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
        });

        // Update win streak
        metrics.win_streak = Math.max(metrics.win_streak, metrics.current_win_streak);

        // Calculate win rate and average return
        metrics.win_rate = trades.length > 0 ? (metrics.winning_trades / trades.length) * 100 : 0;
        metrics.average_return = trades.length > 0 ? total_return / trades.length : 0;

        // Ensure all calculated values are numbers
        Object.keys(metrics).forEach(key => {
            metrics[key] = Number(metrics[key]) || 0;
        });

        // Update user with new trades and metrics
        await db.collection('users').updateOne(
            { email: req.params.email },
            { 
                $set: { 
                    trades: trades,
                    metrics: metrics,
                    updatedAt: new Date()
                }
            }
        );

        console.log('Trade saved successfully:', {
            tradeData,
            metrics: metrics
        });

        res.json({
            message: 'Trade added successfully',
            trades: trades,
            metrics: metrics
        });

    } catch (error) {
        console.error('Error in POST /api/trade/:email:', error);
        res.status(500).json({ 
            error: 'Failed to save trade',
            details: error.message
        });
    }
});

// Update user settings
app.put('/api/user/:email/settings', checkDbConnection, async (req, res) => {
    try {
        console.log('Received settings update request for:', req.params.email);
        console.log('Request body:', {
            ...req.body
        });

        const { tradingCapital, tradingExperience } = req.body;
        
        // Validate trading capital
        if (tradingCapital && (isNaN(tradingCapital) || tradingCapital < 0)) {
            console.error('Invalid trading capital:', tradingCapital);
            return res.status(400).json({ error: 'Invalid trading capital value' });
        }

        // Validate trading experience
        const validExperiences = ['0-1', '1-2', '2-3', '3+'];
        if (tradingExperience && !validExperiences.includes(tradingExperience)) {
            console.error('Invalid trading experience:', tradingExperience);
            return res.status(400).json({ error: 'Invalid trading experience value' });
        }

        // Create update object with only provided fields
        const updateFields = {};
        if (tradingCapital !== undefined) updateFields.tradingCapital = tradingCapital;
        if (tradingExperience !== undefined) updateFields.tradingExperience = tradingExperience;
        updateFields.updatedAt = new Date();

        console.log('Updating user with fields:', Object.keys(updateFields));

        // Set response headers
        res.setHeader('Content-Type', 'application/json');

        const result = await db.collection('users').findOneAndUpdate(
            { email: req.params.email },
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!result.value) {
            console.error('User not found:', req.params.email);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('Settings updated successfully for:', req.params.email);
        res.json(result.value);
    } catch (error) {
        console.error('Error in PUT /api/user/:email/settings:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
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