const express = require('express');
const router = express.Router();
const { createBookingDetails, getBookingDetails, searchBookingsController } = require('../controllers/bookingController');
const bookingService = require('../services/bookingService');
const { pool } = require('../config/db');

// Create booking route
router.post('/create-booking', createBookingDetails);

// Get booking details by ID route
//router.get('/:bookingId', getBookingDetails);

// Search bookings route
router.post('/search', searchBookingsController);

// Cancel booking route
router.post('/cancel/:bookingId', async (req, res) => {
  console.log("booking id-------",req);
    try {
        const bookingId = req.params.bookingId;
        const { reason } = req.body;
        
        // Start a transaction
        await pool.query('START TRANSACTION');

        try {
            // 1. Get booking details
            const [bookings] = await pool.execute(
                'SELECT * FROM BookingTaxis WHERE booking_id = ? AND status = "confirmed"',
                [bookingId]
            );

            if (bookings.length === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: "Booking not found or already cancelled"
                });
            }

            const booking = bookings[0];

            // 2. Update TaxiAvailabilityByDate to restore availability
            if (booking.travel_date && booking.vehicle_type) {
                await pool.execute(
                    `UPDATE TaxiAvailabilityByDate 
                     SET available_count = available_count + 1
                     WHERE travel_date = ? 
                     AND vehicle_type = ?`,
                    [booking.travel_date, booking.vehicle_type]
                );
            }

            // 3. Update booking status to cancelled
            await pool.execute(
                'UPDATE BookingTaxis SET status = "cancelled" WHERE booking_id = ?',
                [bookingId]
            );

            // 4. Move to PastBookings
            await pool.execute(
                `INSERT INTO PastBookings 
                 (booking_date, travel_date, vehicle_type, 
                  number_of_passengers, pickup_location, drop_location, 
                  user_id, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    booking.booking_date || null,
                    booking.travel_date || null,
                    booking.vehicle_type || null,
                    booking.number_of_passengers || null,
                    booking.pickup_location || null,
                    booking.drop_location || null,
                    booking.user_id || null,
                    'cancelled'
                ]
            );

            // 5. Delete from BookingTaxis
            // await pool.execute(
            //     'DELETE FROM BookingTaxis WHERE booking_id = ?',
            //     [bookingId]
            // );

            // Commit the transaction
            await pool.query('COMMIT');

            return res.json({
                success: true,
                message: "Booking cancelled successfully",
                data: {
                    bookingId: booking.booking_id,
                    travelDate: booking.travel_date,
                    vehicleType: booking.vehicle_type,
                    status: 'cancelled',
                    reason: reason || 'No reason provided'
                }
            });
        } catch (error) {
            // Rollback the transaction on error
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
            error: error.message
        });
    }
});

// Add new route for clearing table data
router.post('/clear-data', async (req, res) => {
  try {
    const result = await bookingService.clearTableData();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to clear table data",
      error: error.message
    });
  }
});

module.exports = router; 