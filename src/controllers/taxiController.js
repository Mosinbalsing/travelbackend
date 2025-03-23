const { getAvailableTaxis, mobileexist, storeUserDetailsService } = require("../services/taxiService");

const showAvailableTaxis = async (req, res) => {
    try {
        const { dropOffLocation, pickUpLocation, departureDate } = req.body;
        console.log(pickUpLocation, dropOffLocation, departureDate);
        console.log("req.body", req.body);

        // Validate required fields
        if (!pickUpLocation || !dropOffLocation || !departureDate) {
            return res.status(400).json({
                success: false,
                message: "Pickup location, drop location, and date are required"
            });
        }

        // Format date if needed
        const formattedDate = new Date(departureDate).toISOString().split('T')[0];

        const response = await getAvailableTaxis(pickUpLocation, dropOffLocation, formattedDate);

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

const mobile_exists = async (req, res) => {
    try {
        const { mobile } = req.body;
        console.log("Taxi Controller req.body", req.body);
        console.log("Taxi Controller mobile", mobile);

        // Validate if mobile number is provided
        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required"
            });
        }

        // Check if mobile number exists in the database
        const response = await mobileexist(mobile);

        // If mobile exists, respond with success
        if (response.success) {
            return res.status(200).json(response);
        } else {
            // If mobile does not exist, respond with not found
            return res.status(404).json(response);
        }
    } catch (error) {
        console.error("Error in mobile_exists controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const storeUserDetails = async (req, res) => {
    try {
        const { name, email, mobile } = req.body.mobile;
        console.log("req.body", req.body);
        console.log("name", name);
        console.log("email", email);
        console.log("mobile", mobile);

        // Validate if name, email, and mobile number are provided
        if (!name || !email || !mobile) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and mobile number are required"
            });
        }

        // Store user details in the database
        const response = await storeUserDetailsService(name, email, mobile); // Call the service function

        if (response.success) {
            return res.status(201).json(response);
        } else {
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Error in storeUser Details controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = { showAvailableTaxis, mobile_exists, storeUserDetails };