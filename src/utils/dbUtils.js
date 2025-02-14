const { pool } = require("../config/db");

// Function to create tables only
const createTables = async () => {
  try {
    // Create AvailableTaxis table if it doesn't exist
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
          Sedan_Available INT DEFAULT 4,
          Hatchback_Available INT DEFAULT 2,
          SUV_Available INT DEFAULT 1,
          Prime_SUV_Available INT DEFAULT 1
      )
    `);

    // Create BookedTaxis table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS BookedTaxis (
          BookingID INT AUTO_INCREMENT PRIMARY KEY,
          TaxiID INT,
          UserID INT,
          VehicleType ENUM('Sedan', 'Hatchback', 'SUV', 'Prime_SUV'),
          BookedDate DATE NOT NULL,
          FOREIGN KEY (TaxiID) REFERENCES AvailableTaxis(TaxiID)
      )
    `);

    console.log("✅ Tables created successfully!");
  } catch (error) {
    console.error("❌ Error in creating tables:", error);
    throw error;
  }
};

// Function to drop tables (use carefully!)
const dropTables = async () => {
  try {
    await pool.query(`DROP TABLE IF EXISTS BookedTaxis`);
    await pool.query(`DROP TABLE IF EXISTS AvailableTaxis`);
    console.log("✅ Tables dropped successfully!");
  } catch (error) {
    console.error("❌ Error in dropping tables:", error);
    throw error;
  }
};

// Function to insert initial data if table is empty
const insertInitialData = async () => {
  try {
    // Check if data already exists
    const [existingData] = await pool.query('SELECT COUNT(*) as count FROM AvailableTaxis');
    
    if (existingData[0].count === 0) {
      await pool.query(`
        INSERT INTO AvailableTaxis 
        (PickupLocation, DropLocation, 
         Sedan_Price, Hatchback_Price, SUV_Price, Prime_SUV_Price,
         Sedan_Available, Hatchback_Available, SUV_Available, Prime_SUV_Available)
        VALUES
        ('Pune', 'Mumbai', 2500, 2000, 3500, 4500, 4, 2, 1, 1),
        ('Pune', 'Kolhapur', 3700, 3200, 4500, 5500, 4, 2, 1, 1),
        ('Pune', 'Alibaug', 3500, 3000, 4000, 4500, 4, 2, 1, 1),
        ('Pune', 'Satara', 2500, 2000, 4500, 5500, 4, 2, 1, 1),
        ('Pune', 'Mahabaleshwar', 2500, 2000, 3500, 4500, 4, 2, 1, 1)
      `);
      console.log("✅ Initial data inserted successfully!");
    } else {
      console.log("ℹ️ Data already exists, skipping initial insert");
    }
  } catch (error) {
    console.error("❌ Error in inserting initial data:", error);
    throw error;
  }
};

// Function to add new route
const addNewRoute = async (pickupLocation, dropLocation, prices) => {
  try {
    await pool.query(`
      INSERT INTO AvailableTaxis 
      (PickupLocation, DropLocation, 
       Sedan_Price, Hatchback_Price, SUV_Price, Prime_SUV_Price,
       Sedan_Available, Hatchback_Available, SUV_Available, Prime_SUV_Available)
      VALUES (?, ?, ?, ?, ?, ?, 4, 2, 1, 1)
    `, [
      pickupLocation, 
      dropLocation, 
      prices.sedanPrice, 
      prices.hatchbackPrice, 
      prices.suvPrice, 
      prices.primeSuvPrice
    ]);
    console.log("✅ New route added successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error in adding new route:", error);
    throw error;
  }
};

// Function to update route prices
const updateRoutePrices = async (taxiId, prices) => {
  try {
    await pool.query(`
      UPDATE AvailableTaxis 
      SET Sedan_Price = ?,
          Hatchback_Price = ?,
          SUV_Price = ?,
          Prime_SUV_Price = ?
      WHERE TaxiID = ?
    `, [
      prices.sedanPrice, 
      prices.hatchbackPrice, 
      prices.suvPrice, 
      prices.primeSuvPrice,
      taxiId
    ]);
    console.log("✅ Route prices updated successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error in updating route prices:", error);
    throw error;
  }
};

// Initialize database (create tables and add initial data if needed)
const initializeDatabase = async () => {
  try {
    await createTables();
    await insertInitialData();
    console.log("✅ Database initialized successfully!");
  } catch (error) {
    console.error("❌ Error in database initialization:", error);
    throw error;
  }
};

module.exports = { 
  createTables, 
  dropTables, 
  insertInitialData, 
  addNewRoute, 
  updateRoutePrices,
  initializeDatabase 
};
