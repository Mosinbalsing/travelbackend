const express = require('express'); 
const { register, login ,getUserFromTokencontroller} = require('../controllers/authController');
const { showAvailableTaxis } = require('../controllers/taxiController');
const router = express.Router();

router.post('/signup', register);
router.post('/login', login);
router.get('/getuserdata', getUserFromTokencontroller);
router.post('/available-taxis', showAvailableTaxis);

module.exports = router;