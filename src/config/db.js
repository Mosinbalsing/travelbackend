const mysql2 = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Using the direct connection URL
const pool = mysql2.createPool('mysql://root:pXIyoajJDzLIWPFLEcPyBxYvcGphKMgn@monorail.proxy.rlwy.net:56376/railway');

const checkConnection = async () => {
    try {
        // Add retry logic
        let retries = 3;
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
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
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
