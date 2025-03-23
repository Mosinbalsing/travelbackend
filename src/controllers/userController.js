const { pool } = require('../config/db');

const getUserByMobile = async (req, res) => {
    try {
        const { mobile } = req.body;
        
        // Input validation
        if (!mobile) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mobile number is required' 
            });
        }

        // Query to find user by mobile from user table
        const query = 'SELECT user_id, name, email, mobile, created_at FROM User WHERE mobile = ?';
        
        const [user] = await pool.execute(query, [mobile]);

        if (!user || user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: user[0]
        });

    } catch (error) {
        console.error('Error in getUserByMobile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getUserByMobile
}; 