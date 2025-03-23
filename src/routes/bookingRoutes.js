const express = require('express');
const router = express.Router();
const { createBookingDetails } = require('../controllers/bookingController');

// Create booking route
router.post('/create-booking', createBookingDetails);

module.exports = router; 