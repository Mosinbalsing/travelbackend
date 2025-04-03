const { pool } = require("../config/db");
const bcrypt = require('bcrypt');

const dropBookingsTable = async () => {
    try {
        await pool.query('DROP TABLE IF EXISTS BookedTaxis');
        console.log("✅ Bookings table dropped successfully!");
    } catch (error) {
        console.error("❌ Error dropping bookings table:", error);
        throw error;
    }
};

const createTablesIfNotExist = async () => {
    try {
        // First, create the users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                mobile VARCHAR(20) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                isAdmin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Then create the AvailableTaxis table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS AvailableTaxis (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                pickup_location VARCHAR(255) NOT NULL,
                drop_location VARCHAR(255) NOT NULL,
                Sedan_Price DECIMAL(10,2) DEFAULT 0,
                Hatchback_Price DECIMAL(10,2) DEFAULT 0,
                SUV_Price DECIMAL(10,2) DEFAULT 0,
                Prime_SUV_Price DECIMAL(10,2) DEFAULT 0,
                Sedan_Available INT DEFAULT 0,
                Hatchback_Available INT DEFAULT 0,
                SUV_Available INT DEFAULT 0,
                Prime_SUV_Available INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Finally, create the BookingTaxis table with the foreign key
        await pool.query(`
            CREATE TABLE IF NOT EXISTS BookingTaxis (
                booking_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                travel_date DATE NOT NULL,
                departure_time TIME NOT NULL,
                vehicle_type ENUM('Sedan', 'Hatchback', 'SUV', 'Prime_SUV') NOT NULL,
                number_of_passengers INT NOT NULL,
                pickup_location VARCHAR(255) NOT NULL,
                drop_location VARCHAR(255) NOT NULL,
                status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
                price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ All tables created successfully');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    }
};

const initializeDatabase = async () => {
    try {
        // Drop existing tables if they exist
        // await pool.query('DROP TABLE IF EXISTS BookingTaxis');
        // await pool.query('DROP TABLE IF EXISTS AvailableTaxis');
        // await pool.query('DROP TABLE IF EXISTS users');

        // Create tables if they don't exist
        await createTablesIfNotExist();
        await createAdminTable();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
};

// Add this function to create Admin table
const createAdminTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Admin (
                admin_id INT PRIMARY KEY AUTO_INCREMENT,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                mobile VARCHAR(15) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Admin table created successfully");

        // Insert default admin if not exists
        const defaultAdmin = {
            email: 'sneha@gmail.com',
            password: 'Admin123',
            mobile: '9604064897'
        };

        // Check if admin exists
        const [existing] = await pool.query('SELECT * FROM Admin WHERE email = ?', [defaultAdmin.email]);
        
        if (existing.length === 0) {
            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
            
            // Insert the admin record
            await pool.query(
                'INSERT INTO Admin (email, password, mobile) VALUES (?, ?, ?)',
                [defaultAdmin.email, hashedPassword, defaultAdmin.mobile]
            );
            console.log('Default admin account created successfully');
        }
    } catch (error) {
        console.error("Error in admin table operations:", error);
        throw error;
    }
};


const insertDefaultAdmin = async () => {
    try {
        const defaultAdmin = {
            email: "sneha@gmail.com",
            password: "Admin123",
            mobile: "9604064897"
        };

        const [existing] = await pool.query("SELECT * FROM Admin WHERE email = ?", [defaultAdmin.email]);
        if (existing.length === 0) {
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
            await pool.query(
                "INSERT INTO Admin (email, password, mobile) VALUES (?, ?, ?)",
                [defaultAdmin.email, hashedPassword, defaultAdmin.mobile]
            );
            console.log("✅ Default admin account created successfully!");
        }
    } catch (error) {
        console.error("❌ Error inserting default admin:", error);
        throw error;
    }
};
insertDefaultAdmin()
module.exports = { 
    insertDefaultAdmin,
    createTablesIfNotExist, 
    initializeDatabase,
    createAdminTable,
    dropBookingsTable
};
