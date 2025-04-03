const { pool } = require('../config/db');

const seedInitialData = async () => {
    try {
        // Insert initial data into AvailableTaxis
        await pool.query(`
            INSERT INTO AvailableTaxis 
            (pickup_location, drop_location, Sedan_Price, Hatchback_Price, SUV_Price, Prime_SUV_Price, Sedan_Available, Hatchback_Available, SUV_Available, Prime_SUV_Available)
            VALUES 
            ('Mumbai', 'Pune', 1500, 1200, 2000, 2500, 5, 5, 5, 5),
            ('Pune', 'Mumbai', 1500, 1200, 2000, 2500, 5, 5, 5, 5),
            ('Mumbai', 'Nashik', 1200, 1000, 1800, 2200, 5, 5, 5, 5),
            ('Nashik', 'Mumbai', 1200, 1000, 1800, 2200, 5, 5, 5, 5),
            ('Pune', 'Nashik', 1000, 800, 1500, 1800, 5, 5, 5, 5),
            ('Nashik', 'Pune', 1000, 800, 1500, 1800, 5, 5, 5, 5)
            ON DUPLICATE KEY UPDATE
            Sedan_Price = VALUES(Sedan_Price),
            Hatchback_Price = VALUES(Hatchback_Price),
            SUV_Price = VALUES(SUV_Price),
            Prime_SUV_Price = VALUES(Prime_SUV_Price),
            Sedan_Available = VALUES(Sedan_Available),
            Hatchback_Available = VALUES(Hatchback_Available),
            SUV_Available = VALUES(SUV_Available),
            Prime_SUV_Available = VALUES(Prime_SUV_Available)
        `);

        // Create default admin user if not exists
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await pool.query(`
            INSERT INTO users (username, name, email, mobile, password, isAdmin)
            VALUES ('admin', 'Admin User', 'admin@example.com', '1234567890', ?, true)
            ON DUPLICATE KEY UPDATE
            password = VALUES(password),
            isAdmin = VALUES(isAdmin)
        `, [hashedPassword]);

        console.log('✅ Initial data seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding initial data:', error);
        throw error;
    }
};

module.exports = { seedInitialData }; 