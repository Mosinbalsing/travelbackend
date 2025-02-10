const express = require('express'); 
const { register, login ,getUserFromTokencontroller} = require('../controllers/authController');
const router = express.Router();

router.post('/signup', register);
router.post('/login', login);
router.get('/getuserdata', getUserFromTokencontroller);

module.exports = router;