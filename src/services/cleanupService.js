const { pool } = require("../config/db");

const dropTables = async () => {
    try {
        await pool.query('START TRANSACTION');

        try {
            // Drop tables in correct order due to foreign key constraints
            console.log('Dropping BookingTaxis table...');
            await pool.query('DROP TABLE IF EXISTS bookings');
            
            console.log('Dropping PastBookings table...');
            await pool.query('DROP TABLE IF EXISTS BookedTaxis');
            
            console.log('Dropping User table...');
            await pool.query('DROP TABLE IF EXISTS users');

            await pool.query('COMMIT');
            return {
                success: true,
                message: "Tables dropped successfully"
            };
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error dropping tables:", error);
        return {
            success: false,
            message: "Failed to drop tables",
            error: error.message
        };
    }
};

module.exports = { dropTables }; 