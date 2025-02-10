const { pool } = require("../config/db");

const createTable = async () => {
  try {
    // Check if the table already exists
    const result = await pool.query(`
      SELECT COUNT(*) AS count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'users';
    `);

    if (result[0][0].count > 0) {
      console.log("✅ Users table already exists. Skipping creation.");
      return;
    }

    // Create the table if it doesn't exist
    await pool.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        mobile VARCHAR(15) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Users table created successfully!");
  } catch (error) {
    console.error("❌ Error creating users table:", error);
  }
};

// Call the function

module.exports = { createTable };
