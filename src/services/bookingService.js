const { pool } = require("../config/db");

const createBookingTable = async () => {
    try {
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
        console.log("BookingTaxis table created successfully");
    } catch (error) {
        console.error("Error creating BookingTaxis table:", error);
        throw error;
    }
};

const createBooking = async (bookingData) => {
    try {
        await createBookingTable();

        const [user] = await pool.query(
            'SELECT user_id FROM User WHERE mobile = ?',
            [bookingData.userDetails.mobile]
        );

        if (!user || user.length === 0) {
            return {
                success: false,
                message: "User not found"
            };
        }

        const userId = user[0].user_id;
        const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Start a transaction
        await pool.query('START TRANSACTION');

        try {
            // 1. Check if vehicle is available for specific route
            let checkColumn;
            switch (bookingData.vehicleType) {
                case 'Sedan':
                    checkColumn = 'Sedan_Available';
                    break;
                case 'Hatchback':
                    checkColumn = 'Hatchback_Available';
                    break;
                case 'SUV':
                    checkColumn = 'SUV_Available';
                    break;
                case 'Prime_SUV':
                    checkColumn = 'Prime_SUV_Available';
                    break;
                default:
                    throw new Error('Invalid vehicle type');
            }

            // Check availability for specific route
            const [availability] = await pool.query(
                `SELECT ${checkColumn} FROM AvailableTaxis 
                 WHERE PickupLocation = ? AND DropLocation = ? AND ${checkColumn} > 0`,
                [bookingData.pickupLocation, bookingData.dropLocation]
            );

            if (!availability || availability.length === 0) {
                await pool.query('ROLLBACK');
                return {
                    success: false,
                    message: "No vehicles available for this route"
                };
            }

            // 2. Insert booking details
            const [result] = await pool.query(
                `INSERT INTO BookingTaxis (
                    booking_date,
                    travel_date,
                    vehicle_type,
                    number_of_passengers,
                    pickup_location,
                    drop_location,
                    user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    currentDateTime,
                    bookingData.travelDate,
                    bookingData.vehicleType,
                    bookingData.numberOfPassengers,
                    bookingData.pickupLocation,
                    bookingData.dropLocation,
                    userId
                ]
            );

            // 3. Update AvailableTaxis (decrease count) for specific route only
            const [updateResult] = await pool.query(
                `UPDATE AvailableTaxis 
                 SET ${checkColumn} = ${checkColumn} - 1 
                 WHERE PickupLocation = ? 
                 AND DropLocation = ? 
                 AND ${checkColumn} > 0`,
                [bookingData.pickupLocation, bookingData.dropLocation]
            );

            if (updateResult.affectedRows === 0) {
                await pool.query('ROLLBACK');
                return {
                    success: false,
                    message: "Failed to update vehicle availability"
                };
            }

            // Commit the transaction
            await pool.query('COMMIT');

            // 4. Schedule restoration after 5 minutes for specific route only
            setTimeout(async () => {
                try {
                    await pool.query(
                        `UPDATE AvailableTaxis 
                         SET ${checkColumn} = ${checkColumn} + 1 
                         WHERE PickupLocation = ? 
                         AND DropLocation = ?`,
                        [bookingData.pickupLocation, bookingData.dropLocation]
                    );
                    console.log(`Restored availability for ${bookingData.vehicleType} on route ${bookingData.pickupLocation} to ${bookingData.dropLocation}`);
                } catch (error) {
                    console.error('Error restoring availability:', error);
                }
            }, 5 * 60); // 5 minutes

            return {
                success: true,
                message: "Booking created successfully",
                data: {
                    booking_id: result.insertId,
                    bookingDate: currentDateTime,
                    travelDate: bookingData.travelDate,
                    vehicleType: bookingData.vehicleType,
                    numberOfPassengers: bookingData.numberOfPassengers,
                    pickupLocation: bookingData.pickupLocation,
                    dropLocation: bookingData.dropLocation,
                    userDetails: bookingData.userDetails
                }
            };
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error creating booking:", error);
        return {
            success: false,
            message: "Failed to create booking",
            error: error.message
        };
    }
};

// Also update the restoreAvailability function to handle specific routes
const restoreAvailability = async (vehicleType, pickupLocation, dropLocation) => {
    try {
        let updateColumn;
        switch (vehicleType) {
            case 'Sedan':
                updateColumn = 'Sedan_Available';
                break;
            case 'Hatchback':
                updateColumn = 'Hatchback_Available';
                break;
            case 'SUV':
                updateColumn = 'SUV_Available';
                break;
            case 'Prime_SUV':
                updateColumn = 'Prime_SUV_Available';
                break;
            default:
                throw new Error('Invalid vehicle type');
        }

        await pool.query(
            `UPDATE AvailableTaxis 
             SET ${updateColumn} = ${updateColumn} + 1
             WHERE PickupLocation = ? 
             AND DropLocation = ?`,
            [pickupLocation, dropLocation]
        );

        console.log(`Restored availability for ${vehicleType} on route ${pickupLocation} to ${dropLocation}`);
    } catch (error) {
        console.error('Error restoring availability:', error);
        throw error;
    }
};

// Add a function to handle expired bookings
const handleExpiredBookings = async () => {
    try {
        // Get expired bookings
        const [expiredBookings] = await pool.query(`
            SELECT vehicle_type 
            FROM BookingTaxis 
            WHERE travel_date < CURDATE() 
            AND status = 'confirmed'
        `);

        // Restore availability for each expired booking
        for (const booking of expiredBookings) {
            await restoreAvailability(booking.vehicle_type, booking.pickup_location, booking.drop_location);
        }

        // Update status of expired bookings
        await pool.query(`
            UPDATE BookingTaxis 
            SET status = 'completed' 
            WHERE travel_date < CURDATE() 
            AND status = 'confirmed'
        `);

    } catch (error) {
        console.error('Error handling expired bookings:', error);
    }
};

// Update module exports
module.exports = { 
    createBooking,
    handleExpiredBookings,
    restoreAvailability 
}; 