const express = require('express'); 
const { register, login ,getUserFromTokencontroller} = require('../controllers/authController');
const { showAvailableTaxis, mobile_exists , storeUserDetails } = require('../controllers/taxiController');
const router = express.Router();
const { sendOTPController, verifyOTPController } = require('../controllers/otpController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { getUserByMobile } = require('../controllers/userController');
const { updateAllTaxiInventory } = require('../services/taxiService');

router.post('/signup', register);
router.post('/login', login);
router.get('/getuserdata', getUserFromTokencontroller);
router.post('/available-taxis', showAvailableTaxis);
router.post('/search-mobile', mobile_exists);
router.post('/store-user-details', storeUserDetails);
// OTP routes as part of auth
router.post('/send-otp', sendOTPController);
router.post('/verify-otp', verifyOTPController);

// Update the route to use POST and remove authMiddleware
router.post('/get-user-by-mobile', getUserByMobile);

// Update this route
router.post('/update-taxi-inventory', async (req, res) => {
    try {
        const result = await updateAllTaxiInventory();
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error while updating taxi inventory",
            error: error.message
        });
    }
});

module.exports = router;