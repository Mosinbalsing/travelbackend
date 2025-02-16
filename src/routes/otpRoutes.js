const express = require('express');
const router = express.Router();
const { sendOTPController, verifyOTPController } = require('../controllers/otpController');


// Route to send OTP
router.post('/send', sendOTPController);

// Route to verify OTP
router.post('/verify', verifyOTPController);

module.exports = router; 