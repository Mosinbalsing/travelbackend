const { pool } = require("../config/db");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const adminLogin = async (credentials) => {
    console.log("admin service ", credentials);
    
    try {
        // Input validation
        if (!credentials.email || !credentials.password) {
            return {
                success: false,
                message: "Email and password are required"
            };
        }

        // Check if admin exists
        const [admins] = await pool.query(
            'SELECT * FROM admin WHERE email = ?',
            [credentials.email]
        );

        if (admins.length === 0) {
            return {
                success: false,
                message: "Invalid email or password"
            };
        }

        const admin = admins[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(credentials.password, admin.password);
        
        if (!isValidPassword) {
            return {
                success: false,
                message: "Invalid email or password"
            };
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                adminId: admin.admin_id,
                email: admin.email,
                role: 'admin'
            },
            process.env.JWT_SECRET || 'your-secret-key', // Make sure to set JWT_SECRET in .env
            { expiresIn: '24h' }
        );

        // Return success response
        return {
            success: true,
            message: "Login successful",
            data: {
                adminId: admin.admin_id,
                email: admin.email,
                mobile: admin.mobile,
                token: token
            }
        };
    } catch (error) {
        console.error("Admin login error:", error);
        return {
            success: false,
            message: "Login failed",
            error: error.message
        };
    }
};

module.exports = {
    adminLogin
}; 