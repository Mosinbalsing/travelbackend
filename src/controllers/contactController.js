const contactService = require('../services/contactService');

const storeContactMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        const result = await contactService.storeContactMessage({
            name,
            email,
            subject,
            message
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error in storeContactMessage controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to store contact message',
            error: error.message
        });
    }
};

module.exports = {
    storeContactMessage
}; 