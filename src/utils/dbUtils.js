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

const dropUserTable = async () => {
    try {
        // Drop the user table if it exists
        await pool.query('DROP TABLE IF EXISTS user');
        console.log("✅ user table dropped successfully!");
        
        // Create the new user table with the correct schema
        await pool.query(`
            CREATE TABLE user (
                user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                mobile VARCHAR(20) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log("✅ user table created successfully!");
    } catch (error) {
        console.error("❌ Error with user table operations:", error);
        throw error;
    }
};

const dropUserColumns = async () => {
    try {
        // Check if columns exist before dropping them
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'User'
        `);

        const existingColumns = columns.map(col => col.COLUMN_NAME);

        // Drop username column if it exists
        if (existingColumns.includes('username')) {
            await pool.query('ALTER TABLE User DROP COLUMN username');
            console.log("✅ username column dropped successfully!");
        }

        // Drop password column if it exists
        if (existingColumns.includes('password')) {
            await pool.query('ALTER TABLE User DROP COLUMN password');
            console.log("✅ password column dropped successfully!");
        }

        // Drop isAdmin column if it exists
        if (existingColumns.includes('isAdmin')) {
            await pool.query('ALTER TABLE User DROP COLUMN isAdmin');
            console.log("✅ isAdmin column dropped successfully!");
        }

        console.log("✅ All specified columns dropped successfully!");
    } catch (error) {
        console.error("❌ Error dropping columns:", error);
        throw error;
    }
};

const createTablesIfNotExist = async () => {
    try {
        // First, create the Users table (note: Users not User)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Users (
                user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                mobile VARCHAR(20) UNIQUE NOT NULL,
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

        // Create TaxiAvailabilityByDate table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS TaxiAvailabilityByDate (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                travel_date DATE NOT NULL,
                vehicle_type ENUM('Sedan', 'Hatchback', 'SUV', 'Prime_SUV') NOT NULL,
                pickup_location VARCHAR(255),
                drop_location VARCHAR(255),
                available_count INT DEFAULT 0,
                restoration_time DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY date_vehicle (travel_date, vehicle_type)
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
                FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
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
        await pool.query('DROP TABLE IF EXISTS BookingTaxis');
        await pool.query('DROP TABLE IF EXISTS TaxiAvailabilityByDate');
        await pool.query('DROP TABLE IF EXISTS AvailableTaxis');
        await pool.query('DROP TABLE IF EXISTS Users'); // Note: Users not User

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
            email: 'mosinbalsing@gmail.com',
            password: 'Admin123',
            mobile: '9730260479'
        };

        
        // Check if admin exists
        const [existing] = await pool.query('SELECT * FROM admin WHERE email = ?', [defaultAdmin.email]);
        
        if (existing.length === 0) {
            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
            
            // Insert the admin record
            await pool.query(
                'INSERT INTO admin (email, password, mobile) VALUES (?, ?, ?)',
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
            email: "mosinbalsing@gmail.com",
            password: "Admin123",
            mobile: "9730260479"
        };

        const [existing] = await pool.query("SELECT * FROM admin WHERE email = ?", [defaultAdmin.email]);
        if (existing.length === 0) {
            const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
            await pool.query(
                "INSERT INTO admin (email, password, mobile) VALUES (?, ?, ?)",
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
const createUserDeletedTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS userDeleted (
                user_id INT UNSIGNED PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                mobile VARCHAR(20) NOT NULL,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log("✅ userDeleted table created successfully!");
    } catch (error) {
        console.error("❌ Error creating userDeleted table:", error);
        throw error;
    }
};

module.exports = { 
    insertDefaultAdmin,
    createTablesIfNotExist, 
    initializeDatabase,
    createAdminTable,
    dropBookingsTable,
    dropUserColumns,
    dropUserTable,
    createUserDeletedTable
};
