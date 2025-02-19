const { pool } = require('../config/db');

const createBooking = async (req, res) => {
    try {
        const {
            userId,
            TaxiID,
            bookingDate,
            PickupLocation,
            pickupAddress,
            pickupCity,
            pickupPincode,
            DropLocation,
            travelDate,
            pickupTime,
            vehicleType,
            numberOfPassengers,
            status,
            price
        } = req.body;

        // Format dates
        const formattedBookingDate = new Date(bookingDate)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

        const formattedTravelDate = new Date(travelDate)
            .toISOString()
            .split('T')[0];

        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Get table structure for debugging
            const [columns] = await connection.query('DESCRIBE AvailableTaxis');
            console.log('Table structure:', columns);

            // Find available taxi based on location and vehicle type
            const [availableTaxis] = await connection.query(
                `SELECT * 
                 FROM AvailableTaxis 
                 WHERE pickUpLocation = ? 
                 AND dropLocation = ? 
                 AND ${vehicleType.toLowerCase().replace(' ', '_')}_Available > 0
                 LIMIT 1`,
                [PickupLocation, DropLocation]
            );

            // Debug log
            console.log('Available taxis:', availableTaxis);

            // If no taxi found, try to find any available taxi
            let selectedTaxiId;
            if (availableTaxis.length > 0) {
                selectedTaxiId = TaxiID; // Use the TaxiID from request
            } else {
                const [anyTaxi] = await connection.query(
                    `SELECT * 
                     FROM AvailableTaxis 
                     WHERE ${vehicleType.toLowerCase().replace(' ', '_')}_Available > 0
                     LIMIT 1`
                );

                if (anyTaxi.length === 0) {
                    throw new Error('No available taxis found for this vehicle type');
                }
                selectedTaxiId = TaxiID; // Use the TaxiID from request
            }

            console.log('Selected taxi_id:', selectedTaxiId);

            // Create booking record
            const [bookingResult] = await connection.query(
                `INSERT INTO bookings (
                    user_id, taxi_id, booking_date, pickup_location, 
                    pickup_address, pickup_city, pickup_pincode, 
                    drop_location, travel_date, pickup_time, 
                    vehicle_type, number_of_passengers, status, price
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, selectedTaxiId, formattedBookingDate, PickupLocation,
                    pickupAddress, pickupCity, pickupPincode,
                    DropLocation, formattedTravelDate, pickupTime,
                    vehicleType.toLowerCase(), numberOfPassengers, status, price
                ]
            );

            // Update vehicle availability for all routes
            let availabilityColumn = `${vehicleType.toLowerCase().replace(' ', '_')}_Available`;
            
            const [updateResult] = await connection.query(
                `UPDATE AvailableTaxis 
                 SET ${availabilityColumn} = 
                    CASE 
                        WHEN ${availabilityColumn} > 0 THEN ${availabilityColumn} - 1 
                        ELSE 0 
                    END
                 WHERE ${availabilityColumn} > 0`
            );

            // Commit transaction
            await connection.commit();

            res.status(201).json({
                success: true,
                message: "Booking created successfully",
                data: {
                    bookingId: bookingResult.insertId,
                    taxiId: selectedTaxiId,
                    vehiclesUpdated: updateResult.affectedRows,
                    price: price
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("Error in createBooking:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create booking",
            error: error.message
        });
    }
};

module.exports = { createBooking }; 