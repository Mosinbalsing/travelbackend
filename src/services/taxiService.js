const { pool } = require("../config/db");

const getAvailableTaxis = async (pickupLocation, dropLocation, date) => {
    try {
        // Validate input parameters
        if (!pickupLocation || !dropLocation || !date) {
            return {
                success: false,
                message: "Pickup location, drop location, and date are required"
            };
        }

        // Format date to YYYY-MM-DD
        const formattedDate = new Date(date).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        // Check if date is in the past
        if (formattedDate < today) {
            return {
                success: false,
                message: "Cannot book for past dates"
            };
        }

        // Get available taxis for the route
        const [routeData] = await pool.query(`
            SELECT * FROM availabletaxis 
            WHERE pickup_location = ? AND drop_location = ?
        `, [pickupLocation, dropLocation]);

        if (!routeData || routeData.length === 0) {
            return {
                success: false,
                message: "No taxis available for this route"
            };
        }

        const route = routeData[0];
        const availableVehicles = [];

        // Check availability for each vehicle type
        const vehicleTypes = [
            { type: 'Sedan', available: 'Sedan_Available', price: 'Sedan_Price' },
            { type: 'Hatchback', available: 'Hatchback_Available', price: 'Hatchback_Price' },
            { type: 'SUV', available: 'SUV_Available', price: 'SUV_Price' },
            { type: 'Prime_SUV', available: 'Prime_SUV_Available', price: 'Prime_SUV_Price' }
        ];

        for (const vehicle of vehicleTypes) {
            // Get total available count from AvailableTaxis
            const totalAvailable = route[vehicle.available];
            const price = route[vehicle.price];

            // Get global availability for this specific date from TaxiAvailabilityByDate
            const [dateAvailability] = await pool.query(`
                SELECT available_count, restoration_time
                FROM TaxiAvailabilityByDate
                WHERE travel_date = ? 
                AND vehicle_type = ?
            `, [formattedDate, vehicle.type]);

            let actualAvailable = totalAvailable;

            // If there's a record for this date, use its available_count
            if (dateAvailability && dateAvailability.length > 0) {
                actualAvailable = dateAvailability[0].available_count;
            }

            // Only add to availableVehicles if there are actually available vehicles
            if (actualAvailable > 0) {
                availableVehicles.push({
                    type: vehicle.type,
                    price: Number(price),
                    availableCount: actualAvailable,
                    totalCount: totalAvailable,
                    message: `${actualAvailable} out of ${totalAvailable} ${vehicle.type}s available for ₹${price}`
                });
            }
        }

        // If no vehicles are available at all
        if (availableVehicles.length === 0) {
            return {
                success: false,
                message: "No vehicles available for this date"
            };
        }

        return {
            success: true,
            message: "Available taxis found successfully",
            data: {
                pickupLocation,
                dropLocation,
                date: formattedDate,
                availableVehicles,
                prices: {
                    Sedan: Number(route.Sedan_Price),
                    Hatchback: Number(route.Hatchback_Price),
                    SUV: Number(route.SUV_Price),
                    Prime_SUV: Number(route.Prime_SUV_Price)
                }
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

const storeUserDetailsService = async (userData) => {
    try {
        const { name, email, mobile } = userData;
        
        // Check if user already exists with the same email
        const [existingUser] = await pool.execute(
            'SELECT * FROM User WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return {
                success: false,
                message: "Email already exists. Please choose a different email address.",
                data: null
            };
        }

        // Check if user already exists with the same mobile
        const [existingMobile] = await pool.execute(
            'SELECT * FROM User WHERE mobile = ?',
            [mobile]
        );

        if (existingMobile.length > 0) {
            return {
                success: false,
                message: "Mobile number already exists. Please use a different mobile number.",
                data: null
            };
        }

        // Insert user data with only the fields that exist in the table
        const [result] = await pool.execute(`
            INSERT INTO User (name, email, mobile) 
            VALUES (?, ?, ?)
        `, [name, email, mobile]);

        return {
            success: true,
            message: "User details stored successfully",
            data: {
                user_id: result.insertId,
                name,
                email,
                mobile
            }
        };
    } catch (error) {
        console.error('Error storing user details:', error);
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
            CREATE TABLE IF NOT EXISTS availabletaxis (
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
            'SELECT * FROM availabletaxis WHERE pickup_location = ? AND drop_location = ?',
            [pickupLocation, dropLocation]
        );

        if (existing.length === 0) {
            await pool.query(`
                INSERT INTO availabletaxis (
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
            const [checkData] = await pool.query('SELECT COUNT(*) as count FROM availabletaxis');
            console.log('Current rows in database:', checkData[0].count);

            // Update all rows with new values
            const [result] = await pool.query(`
                UPDATE availabletaxis 
                SET 
                    Sedan_Available = 2,
                    Hatchback_Available = 4,
                    SUV_Available = 1,
                    Prime_SUV_Available = 1
            `);

            // Verify the update
            const [verifyUpdate] = await pool.query('SELECT * FROM availabletaxis LIMIT 1');
            console.log('Sample row after update:', verifyUpdate[0]);

            // If everything is successful, commit the transaction
            await pool.query('COMMIT');
            
            console.log(`Updated ${result.affectedRows} rows in availabletaxis table`);
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
            UPDATE availabletaxis 
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
            UPDATE availabletaxis 
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