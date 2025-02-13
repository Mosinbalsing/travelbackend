const { pool } = require("../config/db");

const createTable = async () => {
  try {
    // Check if the users table already exists
    const result = await pool.query(`
      SELECT COUNT(*) AS count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'users';
    `);

    if (result[0][0].count > 0) {
      console.log("✅ Users table already exists. Skipping creation.");
    } else {
      // Create the users table if it doesn't exist
      await pool.query(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          mobile VARCHAR(15) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          isAdmin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ Users table created successfully!");
    }

    // Create the AvailableTaxis table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS AvailableTaxis (
          TaxiID INT AUTO_INCREMENT PRIMARY KEY,
          UserID INT,
          PickupLocation VARCHAR(255) NOT NULL,
          DropLocation VARCHAR(255) NOT NULL,
          Sedan_Price DECIMAL(10,2),
          Hatchback_Price DECIMAL(10,2),
          SUV_Price DECIMAL(10,2),
          Prime_SUV_Price DECIMAL(10,2),
          Sedan_isAvailable BOOLEAN DEFAULT TRUE,
          Hatchback_isAvailable BOOLEAN DEFAULT TRUE,
          SUV_isAvailable BOOLEAN DEFAULT TRUE,
          Prime_SUV_isAvailable BOOLEAN DEFAULT TRUE,
          Sedan_VehicleNumber VARCHAR(50),
          Hatchback_VehicleNumber VARCHAR(50),
          SUV_VehicleNumber VARCHAR(50),
          Prime_SUV_VehicleNumber VARCHAR(50),
          SeatingCapacity INT,
          AvailableDate DATE DEFAULT (CURRENT_DATE),
          FOREIGN KEY (UserID) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log("✅ AvailableTaxis table created successfully!");
  } catch (error) {
    console.error("❌ Error creating tables:", error);
  }
};

const insertTaxiData = async () => {
  try {
    await pool.query(`
      INSERT INTO AvailableTaxis 
      (PickupLocation, DropLocation, Sedan_Price, Hatchback_Price, SUV_Price, Prime_SUV_Price, 
       Sedan_isAvailable, Hatchback_isAvailable, SUV_isAvailable, Prime_SUV_isAvailable, 
       Sedan_VehicleNumber, Hatchback_VehicleNumber, SUV_VehicleNumber, Prime_SUV_VehicleNumber, 
       SeatingCapacity, AvailableDate)
      VALUES
      ('Pune', 'Mumbai', 2500, 2500, 3500, 4500, TRUE, TRUE, TRUE, TRUE, 
       'MH12AB1001', 'MH12AB2001', 'MH12AB3001', 'MH12AB4001', 4, '2025-02-12'),

      ('Pune', 'Kolhapur', 3700, 3700, 4500, 5500, TRUE, TRUE, TRUE, TRUE, 
       'MH12CD1002', 'MH12CD2002', 'MH12CD3002', 'MH12CD4002', 4, '2025-02-12'),

      ('Pune', 'Alibaug', 3500, 3500, 4000, 4500, TRUE, TRUE, TRUE, TRUE, 
       'MH14EF1003', 'MH14EF2003', 'MH14EF3003', 'MH14EF4003', 6, '2025-02-12'),

      ('Pune', 'Satara', 2500, 2500, 4500, 5500, TRUE, TRUE, TRUE, TRUE, 
       'MH14GH1004', 'MH14GH2004', 'MH14GH3004', 'MH14GH4004', 4, '2025-02-12'),

      ('Pune', 'Mahabaleshwar', 2500, 2500, 3500, 4500, TRUE, TRUE, TRUE, TRUE, 
       'MH15IJ1005', 'MH15IJ2005', 'MH15IJ3005', 'MH15IJ4005', 4, '2025-02-12'),

      ('Pune', 'Wai', 2500, 2500, 4500, 4500, TRUE, TRUE, TRUE, TRUE, 
       'MH16KL1006', 'MH16KL2006', 'MH16KL3006', 'MH16KL4006', 4, '2025-02-12'),

      ('Pune', 'Panchgani', 2500, 2500, 4500, 5500, TRUE, TRUE, TRUE, TRUE, 
       'MH17MN1007', 'MH17MN2007', 'MH17MN3007', 'MH17MN4007', 4, '2025-02-12'),

      ('Pune', 'Solapur', 3500, 3500, 4500, 5500, TRUE, TRUE, TRUE, TRUE, 
       'MH18OP1008', 'MH18OP2008', 'MH18OP3008', 'MH18OP4008', 6, '2025-02-12'),

      ('Pune', 'Nashik', 3500, 3500, 4500, 5500, TRUE, TRUE, TRUE, TRUE, 
       'MH19QR1009', 'MH19QR2009', 'MH19QR3009', 'MH19QR4009', 4, '2025-02-12'),

      ('Pune', 'Lonavala', 2500, 2500, 3500, 4500, TRUE, TRUE, TRUE, TRUE, 
       'MH20ST1010', 'MH20ST2010', 'MH20ST3010', 'MH20ST4010', 4, '2025-02-12')
    `);
    console.log("✅ Taxi data inserted successfully!");
  } catch (error) {
    console.error("❌ Error inserting taxi data:", error);
  }
};

// Call the function

module.exports = { createTable, insertTaxiData };
