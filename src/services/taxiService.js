const { pool } = require("../config/db");

const getAvailableTaxis = async (pickupLocation, dropLocation, date) => {
    try {
        // Create tables in correct order
        await createUserTable();
        await createTaxiInventoryTable();
        await createPastBookingsTable();
        await createBookingTaxisTable();

        // Handle past bookings
        await handlePastBookings();

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
             WHERE pickup_location = ? AND drop_location = ?`,
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
                    WHERE vehicle_type = 'Sedan' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_sedan_available,
                (t.Hatchback_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE vehicle_type = 'Hatchback' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_hatchback_available,
                (t.SUV_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE vehicle_type = 'SUV' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_suv_available,
                (t.Prime_SUV_Available - COALESCE(
                    (SELECT COUNT(*) FROM BookingTaxis 
                    WHERE vehicle_type = 'Prime_SUV' 
                    AND travel_date = ? 
                    AND status = 'confirmed'), 0
                )) as actual_prime_suv_available,
                (SELECT COUNT(*) FROM BookingTaxis 
                WHERE vehicle_type = 'Sedan' 
                AND travel_date = ? 
                AND status = 'confirmed') as sedan_booked_count,
                (SELECT COUNT(*) FROM BookingTaxis 
                WHERE vehicle_type = 'Hatchback' 
                AND travel_date = ? 
                AND status = 'confirmed') as hatchback_booked_count,
                (SELECT COUNT(*) FROM BookingTaxis 
                WHERE vehicle_type = 'SUV' 
                AND travel_date = ? 
                AND status = 'confirmed') as suv_booked_count,
                (SELECT COUNT(*) FROM BookingTaxis 
                WHERE vehicle_type = 'Prime_SUV' 
                AND travel_date = ? 
                AND status = 'confirmed') as prime_suv_booked_count
            FROM AvailableTaxis t
            WHERE t.pickup_location = ? 
            AND t.drop_location = ?
        `, [date, date, date, date, date, date, date, date, pickupLocation, dropLocation]);

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

        // Add vehicles with actual available counts
        if (row.actual_sedan_available > 0) {
            availableVehicles.push({
                type: 'Sedan',
                price: Number(row.Sedan_Price),
                availableCount: row.actual_sedan_available,
                totalCount: row.Sedan_Available,
                bookedCount: row.sedan_booked_count,
                message: `${row.actual_sedan_available} out of ${row.Sedan_Available} Sedans available`
            });
        }

        if (row.actual_hatchback_available > 0) {
            availableVehicles.push({
                type: 'Hatchback',
                price: Number(row.Hatchback_Price),
                availableCount: row.actual_hatchback_available,
                totalCount: row.Hatchback_Available,
                bookedCount: row.hatchback_booked_count,
                message: `${row.actual_hatchback_available} out of ${row.Hatchback_Available} Hatchbacks available`
            });
        }

        if (row.actual_suv_available > 0) {
            availableVehicles.push({
                type: 'SUV',
                price: Number(row.SUV_Price),
                availableCount: row.actual_suv_available,
                totalCount: row.SUV_Available,
                bookedCount: row.suv_booked_count,
                message: `${row.actual_suv_available} out of ${row.SUV_Available} SUVs available`
            });
        }

        if (row.actual_prime_suv_available > 0) {
            availableVehicles.push({
                type: 'Prime_SUV',
                price: Number(row.Prime_SUV_Price),
                availableCount: row.actual_prime_suv_available,
                totalCount: row.Prime_SUV_Available,
                bookedCount: row.prime_suv_booked_count,
                message: `${row.actual_prime_suv_available} out of ${row.Prime_SUV_Available} Prime SUVs available`
            });
        }

        console.log('Final available vehicles:', availableVehicles);

        return {
            success: true,
            message: "Available taxis found successfully",
            data: {
                routeId: row.TaxiID,
                pickupLocation: row.pickup_location,
                dropLocation: row.drop_location,
                availableDate: date,
                availableVehicles: availableVehicles,
                currentBookings: bookings
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

const storeUserDetailsService = async (userDetails) => {
    try {
        console.log("Storing user details:", userDetails);
        const { name, email, mobile } = userDetails;

        // Generate a username from email (part before @)
        const username = email.split('@')[0];

        // Check if user already exists
        const [existingUser] = await pool.query(
            'SELECT * FROM User WHERE mobile = ? OR email = ?',
            [mobile, email]
        );

        if (existingUser.length > 0) {
            return {
                success: true,
                message: "User already exists",
                data: existingUser[0]
            };
        }

        // Insert new user with username
        const [result] = await pool.query(`
            INSERT INTO User (username, name, email, mobile, password, isAdmin) 
            VALUES (?, ?, ?, ?, ?, false)
        `, [username, name, email, mobile, 'defaultpassword']);

        return {
            success: true,
            message: "User details stored successfully",
            data: {
                user_id: result.insertId,
                username,
                name,
                email,
                mobile
            }
        };
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
                pickup_location VARCHAR(100),
                drop_location VARCHAR(100),
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
        // Create the table only if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS BookingTaxis (
                booking_id INT PRIMARY KEY AUTO_INCREMENT,
                booking_date DATETIME,
                travel_date DATE,
                vehicle_type VARCHAR(50),
                number_of_passengers INT,
                pickup_location VARCHAR(100),
                drop_location VARCHAR(100),
                user_id INT,
                status VARCHAR(20) DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES User(user_id)
            )
        `);
        console.log("BookingTaxis table checked/created successfully");
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
            'SELECT * FROM AvailableTaxis WHERE pickup_location = ? AND drop_location = ?',
            [pickupLocation, dropLocation]
        );

        if (existing.length === 0) {
            await pool.query(`
                INSERT INTO AvailableTaxis (
                    pickup_location, 
                    drop_location, 
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
                    Sedan_Available = 2,
                    Hatchback_Available = 4,
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

const createUserTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS User (
                user_id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100),
                email VARCHAR(100),
                mobile VARCHAR(15),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("User table created successfully");
    } catch (error) {
        console.error("Error creating User table:", error);
        throw error;
    }
};

const dropBookingTaxisTable = async () => {
    try {
        await pool.query('DROP TABLE IF EXISTS BookingTaxis');
        console.log("BookingTaxis table dropped successfully");
    } catch (error) {
        console.error("Error dropping BookingTaxis table:", error);
        throw error;
    }
};

const createPastBookingsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS PastBookings (
                booking_id INT PRIMARY KEY AUTO_INCREMENT,
                booking_date DATETIME,
                travel_date DATE,
                vehicle_type VARCHAR(50),
                number_of_passengers INT,
                pickup_location VARCHAR(100),
                drop_location VARCHAR(100),
                user_id INT,
                status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES User(user_id)
            )
        `);
        console.log("PastBookings table created successfully");
    } catch (error) {
        console.error("Error creating PastBookings table:", error);
        throw error;
    }
};

const decrementAvailableTaxis = async (vehicleType, pickupLocation, dropLocation, travelDate) => {
    try {
        let updateColumn;
        switch (vehicleType) {
            case 'Sedan': updateColumn = 'Sedan_Available'; break;
            case 'Hatchback': updateColumn = 'Hatchback_Available'; break;
            case 'SUV': updateColumn = 'SUV_Available'; break;
            case 'Prime_SUV': updateColumn = 'Prime_SUV_Available'; break;
            default: throw new Error('Invalid vehicle type');
        }

        await pool.query(`
            UPDATE AvailableTaxis 
            SET ${updateColumn} = ${updateColumn} - 1
            WHERE PickupLocation = ? 
            AND DropLocation = ?
        `, [pickupLocation, dropLocation]);

        // Schedule restoration after 5 minutes
        setTimeout(async () => {
            try {
                await incrementAvailableTaxis(vehicleType, pickupLocation, dropLocation);
                console.log(`Restored availability for ${vehicleType} after 5 minutes`);
            } catch (error) {
                console.error('Error in scheduled restoration:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes in milliseconds

        return true;
    } catch (error) {
        console.error("Error decrementing available taxis:", error);
        throw error;
    }
};

const incrementAvailableTaxis = async (vehicleType, pickupLocation, dropLocation) => {
    try {
        let updateColumn;
        switch (vehicleType) {
            case 'Sedan': updateColumn = 'Sedan_Available'; break;
            case 'Hatchback': updateColumn = 'Hatchback_Available'; break;
            case 'SUV': updateColumn = 'SUV_Available'; break;
            case 'Prime_SUV': updateColumn = 'Prime_SUV_Available'; break;
            default: throw new Error('Invalid vehicle type');
        }

        await pool.query(`
            UPDATE AvailableTaxis 
            SET ${updateColumn} = ${updateColumn} + 1
            WHERE PickupLocation = ? 
            AND DropLocation = ?
        `, [pickupLocation, dropLocation]);

        return true;
    } catch (error) {
        console.error("Error incrementing available taxis:", error);
        throw error;
    }
};

const handlePastBookings = async () => {
    try {
        // Start transaction
        await pool.query('START TRANSACTION');

        try {
            // Get past bookings
            const [pastBookings] = await pool.query(`
                SELECT * FROM BookingTaxis 
                WHERE travel_date < CURDATE()
            `);

            if (pastBookings.length > 0) {
                // Insert into PastBookings
                for (const booking of pastBookings) {
                    await pool.query(`
                        INSERT INTO PastBookings (
                            booking_date, travel_date, vehicle_type, 
                            number_of_passengers, pickup_location, drop_location, 
                            user_id, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        booking.booking_date,
                        booking.travel_date,
                        booking.vehicle_type,
                        booking.number_of_passengers,
                        booking.pickup_location,
                        booking.drop_location,
                        booking.user_id,
                        booking.status
                    ]);
                }

                // Delete from BookingTaxis
                await pool.query(`
                    DELETE FROM BookingTaxis 
                    WHERE travel_date < CURDATE()
                `);

                console.log(`Moved ${pastBookings.length} past bookings to PastBookings table`);
            }

            await pool.query('COMMIT');
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error handling past bookings:", error);
        throw error;
    }
};

module.exports = { 
    getAvailableTaxis, 
    mobileexist, 
    storeUserDetailsService,
    cleanupExpiredBookings,
    insertInitialTaxiInventory,
    createBookingTaxisTable,
    updateAllTaxiInventory,
    createUserTable,
    dropBookingTaxisTable,
    createPastBookingsTable,
    decrementAvailableTaxis,
    incrementAvailableTaxis,
    handlePastBookings
};