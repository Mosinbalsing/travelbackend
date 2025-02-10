const mysql2 = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true
});



const checkConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log("Database Connection Successful!!");
        connection.release();
    } catch (error) {
        console.error("Error connecting to database!", error);  // ✅ Use console.error for errors
        throw error;
    }
};

// ✅ Correct export syntax
module.exports = { pool, checkConnection };
