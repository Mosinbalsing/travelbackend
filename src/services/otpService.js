const axios = require('axios');

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

// Add OTP expiration time constant (5 minutes in milliseconds)
const OTP_EXPIRY_TIME = 5 * 60 * 1000;

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
            // Store OTP with expiration timestamp
            otpStore.set(phoneNumber, {
                otp,
                timestamp: Date.now(),
                attempts: 0
            });

            // Set timeout to clear OTP after 5 minutes
            setTimeout(() => {
                if (otpStore.has(phoneNumber)) {
                    otpStore.delete(phoneNumber);
                    console.log(`OTP expired for ${phoneNumber}`);
                }
            }, OTP_EXPIRY_TIME);

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
        console.log("Verifying OTP for:", phoneNumber, "User entered OTP:", userOTP);

        if (!phoneNumber || !userOTP) {
            return {
                success: false,
                message: "Phone number and OTP are required"
            };
        }

        const storedOTPData = otpStore.get(phoneNumber);
        console.log("Stored OTP data:", storedOTPData);

        if (!storedOTPData) {
            return {
                success: false,
                message: "OTP has expired or not sent"
            };
        }

        // Check if OTP has expired
        const now = Date.now();
        if (now - storedOTPData.timestamp > OTP_EXPIRY_TIME) {
            otpStore.delete(phoneNumber);
            return {
                success: false,
                message: "OTP has expired. Please request a new one"
            };
        }

        // Convert both OTPs to strings and trim any whitespace
        const cleanUserOTP = String(userOTP).trim();
        const cleanStoredOTP = String(storedOTPData.otp).trim();

        console.log("Comparing OTPs:", {
            userOTP: cleanUserOTP,
            storedOTP: cleanStoredOTP
        });

        if (cleanUserOTP === cleanStoredOTP) {
            // Delete the OTP after successful verification
            otpStore.delete(phoneNumber);
            
            console.log("OTP verified successfully for:", phoneNumber);
            return {
                success: true,
                message: "OTP verified successfully",
                phoneNumber: phoneNumber
            };
        } else {
            // Increment failed attempts
            storedOTPData.attempts = (storedOTPData.attempts || 0) + 1;
            
            // If too many failed attempts, invalidate the OTP
            if (storedOTPData.attempts >= 3) {
                otpStore.delete(phoneNumber);
                return {
                    success: false,
                    message: "Too many failed attempts. Please request a new OTP"
                };
            }

            console.log("OTP verification failed for:", phoneNumber);
            return {
                success: false,
                message: "Invalid OTP",
                remainingAttempts: 3 - storedOTPData.attempts
            };
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return {
            success: false,
            message: "OTP verification failed",
            error: error.message
        };
    }
};

// Add a cleanup function to remove expired OTPs periodically
const cleanupExpiredOTPs = () => {
    const now = Date.now();
    for (const [phoneNumber, data] of otpStore.entries()) {
        if (now - data.timestamp > OTP_EXPIRY_TIME) {
            otpStore.delete(phoneNumber);
            console.log(`Cleaned up expired OTP for ${phoneNumber}`);
        }
    }
};

// Run cleanup every minute
setInterval(cleanupExpiredOTPs, 60 * 1000);

module.exports = { sendOTP, verifyOTP }; 