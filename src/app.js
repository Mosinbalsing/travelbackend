const express = require('express'); 
const { checkConnection } = require('./config/db.js');
const { initializeDatabase } = require('./utils/dbUtils.js');
const authRoutes = require('./routes/authRoutes');
const cors = require("cors");
const bookingRoutes = require('./routes/bookingRoutes');
const { cleanupExpiredBookings, handleExpiredBookings } = require('./services/taxiService');
const { createBooking } = require('./services/bookingService');
const taxiRoutes = require('./routes/taxiRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Configure CORS with options
app.use(cors({
  origin: ['https://travel.galaxyfabrications.com/','http://localhost:5173', 'https://shreetourstraveling.vercel.app','https://shreetoursandtravels.netlify.app','*','https://shreetravlsandtours.vercel.app','https://shreetraveling.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Access-Control-Allow-Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));


// Enable pre-flight requests for all routes
app.options('*', cors());

// Other middleware
app.use(express.json());  
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/taxi', taxiRoutes);
app.use('/api/admin', adminRoutes);

// Initialize database tables
(async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
})();

// Run cleanup every day at midnight
setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        await handleExpiredBookings();
    }
}, 60000); // Check every minute

app.listen(3000, async () => {
  console.log('Server running on port 3000');
  try {
    await checkConnection();
  } catch (error) {
    console.error('Failed to initialize the database:', error); 
  }
});