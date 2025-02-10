const express = require('express'); 
const { checkConnection } = require('./config/db.js');
const { createTable } = require('./utils/dbUtils.js');
const authRoutes = require('./routes/authRoutes.js'); //✅ Fix import
const cors = require("cors");

const app = express();

app.use(express.json());  
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes); // ✅ Ensure authRoutes is defined

app.listen(3000, async () => {
  console.log('Server running on port 3000');
  try {
    await checkConnection();
    await createTable();
  } catch (error) {
    console.error('Failed to initialize the database:', error); 
  }
});
