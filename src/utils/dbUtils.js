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
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Check if tables exist
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_name IN ('AvailableTaxis')
    `);

    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log("Existing tables:", existingTables);

    // Create AvailableTaxis if it doesn't exist
    if (!existingTables.includes('AvailableTaxis')) {
      console.log("Creating AvailableTaxis table...");
      await connection.query(`
        CREATE TABLE AvailableTaxis (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            pickup_location VARCHAR(255) NOT NULL,
            drop_location VARCHAR(255) NOT NULL,
            Sedan_Available INT DEFAULT 0,
            Hatchback_Available INT DEFAULT 0,
            SUV_Available INT DEFAULT 0,
            Prime_SUV_Available INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Insert initial data only if table was just created
      console.log("Inserting initial data...");
      await connection.query(`
        INSERT INTO AvailableTaxis 
        (pickup_location, drop_location, Sedan_Available, Hatchback_Available, SUV_Available, Prime_SUV_Available)
        VALUES 
        ('Mumbai', 'Pune', 5, 5, 5, 5),
        ('Pune', 'Mumbai', 5, 5, 5, 5),
        ('Mumbai', 'Nashik', 5, 5, 5, 5),
        ('Nashik', 'Mumbai', 5, 5, 5, 5),
        ('Pune', 'Nashik', 5, 5, 5, 5),
        ('Nashik', 'Pune', 5, 5, 5, 5)
      `);
    }

    await connection.commit();
    console.log("✅ Database check completed successfully!");

  } catch (error) {
    await connection.rollback();
    console.error("❌ Error in database operations:", error);
    throw error;
  } finally {
    connection.release();
  }
};

const initializeDatabase = async () => {
  try {
    await createTablesIfNotExist();
    await createAdminTable();
    console.log("✅ Database initialization completed!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    // Don't exit process, just log the error
    console.error(error);
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
            email: 'rahul@gmail.com',
            password: 'Admin123',
            mobile: '9021710342'
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

module.exports = { 
    createTablesIfNotExist, 
    initializeDatabase,
    createAdminTable,
    dropBookingsTable
};
