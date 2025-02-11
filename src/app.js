const express = require('express'); 
const { checkConnection } = require('./config/db.js');
const { createTable } = require('./utils/dbUtils.js');
const authRoutes = require('./routes/authRoutes.js');
const cors = require("cors");

const app = express();

// Configure CORS with options
app.use(cors({
  origin: ['http://localhost:5173', 'https://shreetourstraveling.vercel.app','https://shreetoursandtravels.netlify.app'],
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

app.listen(3000, async () => {
  console.log('Server running on port 3000');
  try {
    await checkConnection();
    await createTable();
  } catch (error) {
    console.error('Failed to initialize the database:', error); 
  }
});