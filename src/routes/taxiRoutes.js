const express = require('express');
const router = express.Router();
const { updateAllTaxiInventory } = require('../services/taxiService');

// Add the route for updating taxi inventory
router.post('/update-taxi-inventory', async (req, res) => {
    try {
        const result = await updateAllTaxiInventory();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update taxi inventory",
            error: error.message
        });
    }
});

module.exports = router; 