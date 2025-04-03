const express = require('express');
const cors = require('cors');
const { checkConnection } = require('./config/db');
const { createTablesIfNotExist } = require('./services/bookingService');
const authRoutes = require('./routes/authRoutes');
const taxiRoutes = require('./routes/taxiRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware

app.use(express.json());
app.use(cors({
  origin: ['https://travel.galaxyfabrications.com/','http://localhost:5173', 'https://shreetourstraveling.vercel.app','https://shreetoursandtravels.netlify.app','*','https://shreetravlsandtours.vercel.app','https://shreetraveling.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/taxis', taxiRoutes);
app.use('/api/admin', adminRoutes);

const startServer = async () => {
    try {
        // Check database connection
        await checkConnection();
        console.log("Database connection successful");

        // Create tables if they don't exist
        await createTablesIfNotExist();
        console.log("Tables checked/created successfully");

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

module.exports = app;