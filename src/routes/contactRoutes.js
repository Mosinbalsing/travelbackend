const express = require('express');
const router = express.Router();
const { storeContactMessage } = require('../controllers/contactController');

// Store contact message route
router.post('/store', storeContactMessage);

module.exports = router; 