const express = require('express');
const router = express.Router();
const { adminLogin, verifyAdminToken } = require('../services/adminService');
const { pool } = require('../config/db');

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Get token from Authorization header
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }

        const result = verifyAdminToken(token);
        if (!result.success) {
            return res.status(401).json(result);
        }

        // Add admin data to request object
        req.admin = result.data;
        next();
    } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during admin verification",
            error: error.message
        });
    }
};

// Admin login route
router.post('/login', async (req, res) => {
    try {
        console.log("Admin login attempt:", req.body);
        
        const credentials = {
            email: req.body.email,
            password: req.body.password
        };

        // Call admin login service
        const result = await adminLogin(credentials);
        console.log("Login result:", result);

        if (result.success) {
            // Successful login
            return res.status(200).json(result);
        } else {
            // Failed login but not an error
            return res.status(401).json(result);
        }
    } catch (error) {
        console.error("Admin login route error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});

// Get all users
router.get('/users', verifyAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT user_id, name, email, mobile FROM user');
        
        return res.json({ 
            success: true, 
            data: users,
            count: users.length
        });
    } catch (error) {
        console.error('Error in user-get route:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

// Update user
router.put('/users/:userId', verifyAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const { name, email, mobile } = req.body;

        // Validate required fields
        if (!name || !email || !mobile) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and mobile are required fields"
            });
        }

        // Check if user exists
        const [existingUsers] = await pool.execute(
            'SELECT * FROM user WHERE user_id = ?',
            [userId]
        );

        if (existingUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Update user
        await pool.execute(
            'UPDATE user SET name = ?, email = ?, mobile = ? WHERE user_id = ?',
            [name, email, mobile, userId]
        );

        // Fetch updated user data
        const [updatedUsers] = await pool.execute(
            'SELECT user_id, name, email, mobile FROM user WHERE user_id = ?',
            [userId]
        );

        return res.json({
            success: true,
            message: "User updated successfully",
            data: updatedUsers[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update user",
            error: error.message
        });
    }
});

// Get all bookings
router.get('/bookings', verifyAdmin, async (req, res) => {
    try {
        console.log('Fetching bookings from database...');
        
        // Fetch booking data with user details
        const [bookings] = await pool.execute(`
            SELECT 
                b.booking_id,
                b.travel_date,
                b.vehicle_type,
                b.pickup_location,
                b.drop_location,
                b.number_of_passengers,
                b.status,
                b.booking_date,
                u.name as user_name,
                u.email as user_email,
                u.mobile as user_mobile
            FROM bookingtaxis b
            LEFT JOIN User u ON b.user_id = u.user_id
            ORDER BY b.booking_date DESC
        `);
        
        console.log(`Successfully fetched ${bookings.length} bookings`);
        
        // Send response
        return res.json({ 
            success: true, 
            data: bookings,
            count: bookings.length
        });
    } catch (error) {
        console.error('Error in bookings-get route:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch bookings',
            error: error.message
        });
    }
});

// Get past bookings
router.get('/pastbookings', verifyAdmin, async (req, res) => {
    try {
        console.log('Fetching past bookings from database...');
        
        // Fetch booking data with user details
        const [pastbookings] = await pool.execute(`
            SELECT 
                b.booking_id,
                b.vehicle_type,
                b.pickup_location,
                b.drop_location,
                b.status,
                b.user_id,
                b.travel_date,
                b.booking_date,
                b.number_of_passengers,
                u.name as user_name,
                u.email as user_email,
                u.mobile as user_mobile
            FROM PastBookings b
            LEFT JOIN User u ON b.user_id = u.user_id
            ORDER BY b.booking_date DESC
        `);
        
        console.log(`Successfully fetched ${pastbookings.length} past bookings`);
        
        // Send response
        return res.json({ 
            success: true, 
            data: pastbookings,
            count: pastbookings.length
        });
    } catch (error) {
        console.error('Error in pastbookings-get route:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch past bookings',
            error: error.message
        });
    }
});

// Delete user and store in userDeleted table
router.post('/deleteuser', verifyAdmin, async (req, res) => {
    let connection;
    try {
        const { user_id } = req.body;
        const userId = user_id;
        console.log(req.body);
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Get a connection from the pool
        connection = await pool.getConnection();

        // Check if user exists
        const [existingUsers] = await connection.execute(
            'SELECT * FROM user WHERE user_id = ?',
            [userId]
        );

        if (existingUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const userToDelete = existingUsers[0];

        // Start a transaction
        await connection.beginTransaction();

        try {
            // Insert user data into userDeleted table
            await connection.execute(
                'INSERT INTO userDeleted (user_id, name, email, mobile, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    userToDelete.user_id,
                    userToDelete.name,
                    userToDelete.email,
                    userToDelete.mobile,
                    userToDelete.created_at,
                    userToDelete.updated_at
                ]
            );

            // Delete user from user table
            await connection.execute(
                'DELETE FROM user WHERE user_id = ?',
                [userId]
            );

            // Commit the transaction
            await connection.commit();

            return res.json({
                success: true,
                message: "User deleted successfully",
                data: {
                    user_id: userToDelete.user_id,
                    name: userToDelete.name,
                    email: userToDelete.email,
                    mobile: userToDelete.mobile
                }
            });
        } catch (error) {
            // Rollback the transaction in case of error
            if (connection) {
                await connection.rollback();
            }
            throw error;
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete user",
            error: error.message
        });
    } finally {
        // Release the connection back to the pool
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router; 