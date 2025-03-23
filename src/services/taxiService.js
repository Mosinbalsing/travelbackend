const { pool } = require("../config/db");

const getAvailableTaxis = async (pickupLocation, dropLocation, date) => {
    try {
        await createTaxiInventoryTable();

        if (!pickupLocation || !dropLocation || !date) {
            return {
                success: false,
                message: "Pickup location, drop location, and date are required"
            };
        }

        await insertInitialTaxiInventory(pickupLocation, dropLocation);

        // First, let's check the raw data in AvailableTaxis
        const [rawData] = await pool.query(
            `SELECT * FROM AvailableTaxis 
             WHERE PickupLocation = ? AND DropLocation = ?`,
            [pickupLocation, dropLocation]
        );
        console.log('Raw AvailableTaxis data:', rawData[0]);

        // Then check existing bookings
        const [bookings] = await pool.query(
            `SELECT vehicle_type, COUNT(*) as booked_count 
             FROM BookingTaxis 
             WHERE pickup_location = ? 
             AND drop_location = ? 
             AND travel_date = ? 
             AND status = 'confirmed'
             GROUP BY vehicle_type`,
            [pickupLocation, dropLocation, date]
        );
        console.log('Current bookings:', bookings);

        // Now get available vehicles with detailed logging
        const [rows] = await pool.query(`
            SELECT 
                t.*,
                (t.Sedan_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE pickup_location = t.PickupLocation 
                    AND drop_location = t.DropLocation 
                    AND vehicle_type = 'Sedan' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_sedan_available,
                (t.Hatchback_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE pickup_location = t.PickupLocation 
                    AND drop_location = t.DropLocation 
                    AND vehicle_type = 'Hatchback' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_hatchback_available,
                (t.SUV_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE pickup_location = t.PickupLocation 
                    AND drop_location = t.DropLocation 
                    AND vehicle_type = 'SUV' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_suv_available,
                (t.Prime_SUV_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE pickup_location = t.PickupLocation 
                    AND drop_location = t.DropLocation 
                    AND vehicle_type = 'Prime_SUV' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_prime_suv_available
            FROM AvailableTaxis t
            WHERE t.PickupLocation = ? 
            AND t.DropLocation = ?
        `, [date, date, date, date, pickupLocation, dropLocation]);

        if (rows.length === 0) {
            return {
                success: false,
                message: "No taxis available for this route and date"
            };
        }

        const row = rows[0];
        const availableVehicles = [];

        // Debug log all availability counts
        console.log('Availability counts:', {
            sedan: {
                total: row.Sedan_Available,
                actual: row.actual_sedan_available,
                price: row.Sedan_Price
            },
            hatchback: {
                total: row.Hatchback_Available,
                actual: row.actual_hatchback_available,
                price: row.Hatchback_Price
            },
            suv: {
                total: row.SUV_Available,
                actual: row.actual_suv_available,
                price: row.SUV_Price
            },
            primeSuv: {
                total: row.Prime_SUV_Available,
                actual: row.actual_prime_suv_available,
                price: row.Prime_SUV_Price
            }
        });

        // Add vehicles with explicit number conversion and debug logs
        const sedanAvailable = Math.max(0, Number(row.Sedan_Available) - Number(row.sedan_booked || 0));
        if (sedanAvailable > 0) {
            console.log('Adding Sedan with count:', sedanAvailable);
            availableVehicles.push({
                type: 'Sedan',
                price: Number(row.Sedan_Price),
                availableCount: sedanAvailable
            });
        }

        const hatchbackAvailable = Math.max(0, Number(row.Hatchback_Available) - Number(row.hatchback_booked || 0));
        if (hatchbackAvailable > 0) {
            availableVehicles.push({
                type: 'Hatchback',
                price: Number(row.Hatchback_Price),
                availableCount: hatchbackAvailable
            });
        }

        const suvAvailable = Math.max(0, Number(row.SUV_Available) - Number(row.suv_booked || 0));
        if (suvAvailable > 0) {
            availableVehicles.push({
                type: 'SUV',
                price: Number(row.SUV_Price),
                availableCount: suvAvailable
            });
        }

        const primeSuvAvailable = Math.max(0, Number(row.Prime_SUV_Available) - Number(row.prime_suv_booked || 0));
        if (primeSuvAvailable > 0) {
            availableVehicles.push({
                type: 'Prime_SUV',
                price: Number(row.Prime_SUV_Price),
                availableCount: primeSuvAvailable
            });
        }

        console.log('Final available vehicles:', availableVehicles);

        return {
            success: true,
            message: "Available taxis found successfully",
            data: {
                routeId: row.TaxiID,
                pickupLocation: row.PickupLocation,
                dropLocation: row.DropLocation,
                availableDate: date,
                availableVehicles: availableVehicles
            }
        };
    } catch (error) {
        console.error("Error fetching available taxis:", error);
        return {
            success: false,
            message: "Failed to fetch available taxis",
            error: error.message
        };
    }
};

const mobileexist = async (mobile) => {
    try {
        // Validate input parameters
        if (!mobile) {
            return {
                success: false,
                message: "Mobile number is required"
            };
        }

        // Query to check if mobile number exists and get user data
        const [rows] = await pool.query(`
            SELECT user_id, name, email, mobile, created_at FROM User WHERE mobile = ? 
        `, [mobile]);

        if (rows.length > 0) {
            // Mobile number exists, return with user data
            return {
                success: true,
                message: "Mobile number exists",
                data: rows[0]  // Include the user data in response
            };
        } else {
            // Mobile number doesn't exist
            return {
                success: false,
                message: "Mobile number does not exist"
            };
        }
    } catch (error) {
        console.error("Error checking mobile number:", error);
        return {
            success: false,
            message: "Failed to check mobile number",
            error: error.message
        };
    }
};
const storeUserDetailsService = async (name, email, mobile) => {
    try {
        // Validate input parameters
        if (!name || !email || !mobile) {
            return {
                success: false,
                message: "Name, email, and mobile number are required"
                };
        }

        // Query to insert user details into the Users table
        const [rows] = await pool.query(`
            INSERT INTO User (name, email, mobile) VALUES (?, ?, ?)
        `, [name, email, mobile]);

        if (rows.affectedRows > 0) {
            // User details inserted successfully
            return {
                success: true,
                message: "User details stored successfully"
            };
        } else {
            // User details insertion failed
            return {
                success: false,
                message: "Failed to store user details"
            };
        }
    } catch (error) {
        console.error("Error storing user details:", error);
        return {
            success: false,
            message: "Failed to store user details",
            error: error.message
        };
    }
};

const createTaxiInventoryTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS AvailableTaxis (
                TaxiID INT PRIMARY KEY AUTO_INCREMENT,
                PickupLocation VARCHAR(100),
                DropLocation VARCHAR(100),
                Sedan_Available INT DEFAULT 2,
                Sedan_Price DECIMAL(10,2),
                Hatchback_Available INT DEFAULT 4,
                Hatchback_Price DECIMAL(10,2),
                SUV_Available INT DEFAULT 1,
                SUV_Price DECIMAL(10,2),
                Prime_SUV_Available INT DEFAULT 1,
                Prime_SUV_Price DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("AvailableTaxis table created successfully");
    } catch (error) {
        console.error("Error creating AvailableTaxis table:", error);
        throw error;
    }
};

const createBookingTaxisTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS BookingTaxis (
                booking_id INT PRIMARY KEY AUTO_INCREMENT,
                pickup_location VARCHAR(100),
                drop_location VARCHAR(100),
                vehicle_type VARCHAR(50),
                travel_date DATE,
                user_id INT,
                booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'confirmed',
                FOREIGN KEY (user_id) REFERENCES User(user_id)
            )
        `);
        console.log("BookingTaxis table created successfully");
    } catch (error) {
        console.error("Error creating BookingTaxis table:", error);
        throw error;
    }
};

const cleanupExpiredBookings = async () => {
    try {
        const [result] = await pool.query(`
            DELETE FROM BookingTaxis 
            WHERE travel_date < CURDATE()
        `);
        
        console.log(`Cleaned up ${result.affectedRows} expired bookings`);
    } catch (error) {
        console.error("Error cleaning up expired bookings:", error);
    }
};

const insertInitialTaxiInventory = async (pickupLocation, dropLocation) => {
    try {
        const [existing] = await pool.query(
            'SELECT * FROM AvailableTaxis WHERE PickupLocation = ? AND DropLocation = ?',
            [pickupLocation, dropLocation]
        );

        if (existing.length === 0) {
            await pool.query(`
                INSERT INTO AvailableTaxis (
                    PickupLocation, 
                    DropLocation, 
                    Sedan_Available, 
                    Sedan_Price,
                    Hatchback_Available,
                    Hatchback_Price,
                    SUV_Available,
                    SUV_Price,
                    Prime_SUV_Available,
                    Prime_SUV_Price
                ) VALUES (?, ?, 4, 1500.00, 2, 1200.00, 1, 2000.00, 1, 2500.00)
            `, [pickupLocation, dropLocation]);
            console.log('Initial inventory inserted for route:', pickupLocation, 'to', dropLocation);
        }
    } catch (error) {
        console.error("Error inserting initial taxi inventory:", error);
        throw error;
    }
};

const updateAllTaxiInventory = async () => {
    try {
        // Start a transaction to ensure data consistency
        await pool.query('START TRANSACTION');

        try {
            // First verify if we have any data
            const [checkData] = await pool.query('SELECT COUNT(*) as count FROM AvailableTaxis');
            console.log('Current rows in database:', checkData[0].count);

            // Update all rows with new values
            const [result] = await pool.query(`
                UPDATE AvailableTaxis 
                SET 
                    Sedan_Available = 4,
                    Hatchback_Available = 2,
                    SUV_Available = 1,
                    Prime_SUV_Available = 1
            `);

            // Verify the update
            const [verifyUpdate] = await pool.query('SELECT * FROM AvailableTaxis LIMIT 1');
            console.log('Sample row after update:', verifyUpdate[0]);

            // If everything is successful, commit the transaction
            await pool.query('COMMIT');
            
            console.log(`Updated ${result.affectedRows} rows in AvailableTaxis table`);
            return {
                success: true,
                message: `Successfully updated ${result.affectedRows} routes with new vehicle counts`,
                affectedRows: result.affectedRows,
                sampleData: verifyUpdate[0]
            };
        } catch (error) {
            // If there's an error, rollback the transaction
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error updating taxi inventory:", error);
        return {
            success: false,
            message: "Failed to update taxi inventory",
            error: error.message
        };
    }
};

module.exports = { 
    getAvailableTaxis, 
    mobileexist, 
    storeUserDetailsService,
    cleanupExpiredBookings,
    insertInitialTaxiInventory,
    createBookingTaxisTable,
    updateAllTaxiInventory 
};