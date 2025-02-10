const express = require('express'); 
const { checkConnection } = require('./config/db.js');
const { createTable } = require('./utils/dbUtils.js');
const authRoutes = require('./routes/authRoutes.js');
const cors = require("cors");

const app = express();

// Configure CORS with options
app.use(cors({
  origin: "*" , // Add your frontend URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

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