const axios = require('axios');

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000);
};

const sendOTP = async (phoneNumber) => {
    try {
        const otp = generateOTP();
        
        if (!process.env.FAST2SMS_API_KEY) {
            throw new Error('Fast2SMS API key is not configured');
        }

        // Using correct format for OTP route
        const options = {
            method: 'GET',
            url: 'https://www.fast2sms.com/dev/bulkV2',
            params: {
                authorization: process.env.FAST2SMS_API_KEY.trim(),
                variables_values: otp.toString(),  // Only send the OTP number
                route: 'otp',
                numbers: phoneNumber.trim()
            }
        };

        console.log('Sending OTP:', otp, 'to:', phoneNumber);

        const response = await axios.request(options);
        console.log('Fast2SMS Response:', response.data);

        if (response.data.return === true) {
            otpStore.set(phoneNumber, {
                otp,
                timestamp: Date.now(),
                attempts: 0
            });

            return {
                success: true,
                message: "OTP sent successfully"
            };
        }

        return {
            success: false,
            message: response.data.message || "Failed to send OTP"
        };

    } catch (error) {
        console.error("Error sending OTP:", error);
        return {
            success: false,
            message: "Failed to send OTP",
            error: error.response?.data?.message || error.message
        };
    }
};

const verifyOTP = async (phoneNumber, userOTP) => {
    try {
        const storedOTPData = otpStore.get(phoneNumber);
        
        // Debug logs
        console.log('Verification Request:');
        console.log('Phone Number:', phoneNumber);
        console.log('User OTP:', userOTP, 'Type:', typeof userOTP);
        console.log('Stored Data:', storedOTPData);
        
        if (!storedOTPData) {
            return {
                success: false,
                message: "OTP expired or not found"
            };
        }

        // Ensure proper type conversion
        const userOTPNumber = Number(userOTP);
        const storedOTPNumber = Number(storedOTPData.otp);

        // Debug OTP comparison
        console.log('Comparing:');
        console.log('User OTP (converted):', userOTPNumber, 'Type:', typeof userOTPNumber);
        console.log('Stored OTP (converted):', storedOTPNumber, 'Type:', typeof storedOTPNumber);
        console.log('Are equal?:', userOTPNumber === storedOTPNumber);

        // Check if OTP matches
        if (userOTPNumber === storedOTPNumber) {
            // Check expiry
            if (Date.now() - storedOTPData.timestamp > 5 * 60 * 1000) {
                otpStore.delete(phoneNumber);
                return {
                    success: false,
                    message: "OTP expired"
                };
            }

            // OTP is valid and not expired
            otpStore.delete(phoneNumber);
            return {
                success: true,
                message: "OTP verified successfully",
                phoneNumber: phoneNumber
            };
        }

        // Increment attempts
        storedOTPData.attempts += 1;
        console.log('Attempt count:', storedOTPData.attempts);

        // Check max attempts
        if (storedOTPData.attempts >= 3) {
            otpStore.delete(phoneNumber);
            return {
                success: false,
                message: "Max OTP verification attempts exceeded"
            };
        }

        return {
            success: false,
            message: "Invalid OTP",
            debug: {
                received: userOTPNumber,
                expected: storedOTPNumber
            }
        };

    } catch (error) {
        console.error("Error verifying OTP:", error);
        return {
            success: false,
            message: "Error verifying OTP",
            error: error.message
        };
    }
};

module.exports = { sendOTP, verifyOTP }; 