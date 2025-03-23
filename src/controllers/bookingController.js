const { createBooking } = require('../services/bookingService');

const createBookingDetails = async (req, res) => {
    try {
        const bookingData = req.body;

        // Validate required fields
        if (!bookingData.travelDate || !bookingData.vehicleType || 
            !bookingData.pickupLocation || !bookingData.dropLocation || 
            !bookingData.userDetails) {
            return res.status(400).json({
                success: false,
                message: "Missing required booking details"
            });
        }

        const result = await createBooking(bookingData);

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error("Error in createBookingDetails:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    createBookingDetails
}; 