const { sendOTP, verifyOTP } = require("../services/otpService");

const sendOTPController = async (req, res) => {
    try {
        const { phoneNumber, userName} = req.body;
        console.log(phoneNumber, userName);
        
        // Validate input
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Phone number and username are required"
            });
        }

        // Validate phone number format (10 digits)
        if (!/^\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format"
            });
        }

        const result = await sendOTP(phoneNumber);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error("Error in sendOTP controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
        
    }
};

const verifyOTPController = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        // Validate input
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: "Phone number and OTP are required"
            });
        }

        const result = await verifyOTP(phoneNumber, otp);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error("Error in verifyOTP controller:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = { sendOTPController, verifyOTPController }; 