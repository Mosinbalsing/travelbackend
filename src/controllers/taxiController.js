const { getAvailableTaxis } = require("../services/taxiService");

const showAvailableTaxis = async (req, res) => {
    try {
        const { dropOffLocation,  pickUpLocation, departureDate } = req.body;
        console.log( pickUpLocation, dropOffLocation, departureDate);
        console.log("req.body", req.body);

        // Validate required fields
        if (! pickUpLocation || !dropOffLocation || !departureDate) {
            return res.status(400).json({
                success: false,
                message: "Pickup location, drop location, and date are required"
            });
        }

        // Format date if needed
        const formattedDate = new Date(departureDate).toISOString().split('T')[0];

        const response = await getAvailableTaxis( pickUpLocation , dropOffLocation, formattedDate);

        if (response.success) {
            return res.status(200).json(response);
        } else {
            return res.status(404).json(response);
        }
    } catch (error) {
        console.error("Error in showAvailableTaxis controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = { showAvailableTaxis };