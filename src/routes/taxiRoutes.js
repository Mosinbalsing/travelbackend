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

// Add new route to reset taxi availability
router.post("/reset-availability", async (req, res) => {
  try {
    const result = await updateAllTaxiInventory();
    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Taxi availability reset successfully",
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to reset taxi availability",
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error in reset-availability route:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router; 