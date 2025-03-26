const express = require('express');
const router = express.Router();
const { createBookingDetails, getBookingDetails, searchBookingsController } = require('../controllers/bookingController');
const bookingService = require('../services/bookingService');

// Create booking route
router.post('/create-booking', createBookingDetails);

// Get booking details by ID route
//router.get('/:bookingId', getBookingDetails);

// Search bookings route
router.post('/search', searchBookingsController);

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