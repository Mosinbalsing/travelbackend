const { pool } = require("../config/db");

const createTablesIfNotExist = async () => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Check if tables exist
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_name IN ('AvailableTaxis', 'bookings')
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

    // Create bookings if it doesn't exist
    if (!existingTables.includes('bookings')) {
      console.log("Creating bookings table...");
      await connection.query(`
        CREATE TABLE bookings (
            booking_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            taxi_id INT UNSIGNED,
            booking_date DATETIME NOT NULL,
            pickup_location VARCHAR(255) NOT NULL,
            pickup_address TEXT NOT NULL,
            pickup_city VARCHAR(255) NOT NULL,
            pickup_pincode VARCHAR(10) NOT NULL,
            drop_location VARCHAR(255) NOT NULL,
            travel_date DATE NOT NULL,
            pickup_time TIME NOT NULL,
            vehicle_type ENUM('sedan', 'hatchback', 'suv', 'prime suv') NOT NULL,
            number_of_passengers INT NOT NULL,
            status VARCHAR(50) NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_taxi_id (taxi_id),
            CONSTRAINT fk_taxi FOREIGN KEY (taxi_id) 
            REFERENCES AvailableTaxis(id) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
    console.log("✅ Database initialization completed!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    // Don't exit process, just log the error
    console.error(error);
  }
};

module.exports = { createTablesIfNotExist, initializeDatabase };
