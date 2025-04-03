const mysql2 = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Configure the connection pool with proper timeout settings
const pool = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000, // 60 seconds
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const checkConnection = async () => {
    try {
        // Add retry logic with exponential backoff
        let retries = 3;
        let delay = 5000; // Start with 5 seconds delay
        
        while (retries > 0) {
            try {
                const connection = await pool.getConnection();
                console.log("Database Connection Successful!!");
                connection.release();
                return;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                console.log(`Connection attempt failed. Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    } catch (error) {
        console.error("Error connecting to database!", error);
        throw error;
    }
};

// Simple ping function to test connection
const pingDatabase = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('Database ping successful');
        return true;
    } catch (error) {
        console.error('Database ping failed:', error);
        return false;
    }
};

// ✅ Correct export syntax
module.exports = { pool, checkConnection, pingDatabase };
