const express = require('express'); 
const { register, login ,getUserFromTokencontroller} = require('../controllers/authController');
const { showAvailableTaxis } = require('../controllers/taxiController');
const router = express.Router();
const { sendOTPController, verifyOTPController } = require('../controllers/otpController');

router.post('/signup', register);
router.post('/login', login);
router.get('/getuserdata', getUserFromTokencontroller);
router.post('/available-taxis', showAvailableTaxis);

// OTP routes as part of auth
router.post('/send-otp', sendOTPController);
router.post('/verify-otp', verifyOTPController);
     
module.exports = router;