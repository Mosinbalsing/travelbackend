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
        // Get users with their booking counts
        const [users] = await pool.execute(`
            SELECT 
                u.user_id,
                u.name,
                u.email,
                u.mobile,
                u.created_at,
                u.updated_at,
                COUNT(DISTINCT b.booking_id) as total_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'pending' OR b.status = 'confirmed' THEN b.booking_id END) as active_bookings
            FROM User u
            LEFT JOIN BookingTaxis b ON u.user_id = b.user_id
            GROUP BY u.user_id, u.name, u.email, u.mobile, u.created_at, u.updated_at
            ORDER BY u.created_at DESC
        `);
        
        // Get past bookings count for each user
        const [pastBookings] = await pool.execute(`
            SELECT 
                user_id,
                COUNT(*) as past_bookings_count
            FROM PastBookings
            GROUP BY user_id
        `);
        
        // Create a map of user_id to past bookings count
        const pastBookingsMap = {};
        pastBookings.forEach(booking => {
            pastBookingsMap[booking.user_id] = booking.past_bookings_count;
        });
        
        // Get all bookings for each user (both active and past) with price information
        const [allBookings] = await pool.execute(`
            SELECT 
                b.booking_id,
                b.user_id,
                b.travel_date,
                b.vehicle_type,
                b.number_of_passengers,
                b.pickup_location,
                b.drop_location,
                b.status,
                b.booking_date,
                'active' as booking_type,
                CASE 
                    WHEN b.vehicle_type = 'Sedan' THEN a.Sedan_Price
                    WHEN b.vehicle_type = 'Hatchback' THEN a.Hatchback_Price
                    WHEN b.vehicle_type = 'SUV' THEN a.SUV_Price
                    WHEN b.vehicle_type = 'Prime_SUV' THEN a.Prime_SUV_Price
                END as price
            FROM BookingTaxis b
            LEFT JOIN availabletaxis a ON b.pickup_location = a.pickup_location 
                AND b.drop_location = a.drop_location
            ORDER BY b.travel_date DESC
        `);
        
        // Get past bookings for each user with price information
        const [pastBookingsData] = await pool.execute(`
            SELECT 
                pb.booking_id,
                pb.user_id,
                pb.travel_date,
                pb.vehicle_type,
                pb.number_of_passengers,
                pb.pickup_location,
                pb.drop_location,
                pb.status,
                pb.booking_date,
                'past' as booking_type,
                CASE 
                    WHEN pb.vehicle_type = 'Sedan' THEN a.Sedan_Price
                    WHEN pb.vehicle_type = 'Hatchback' THEN a.Hatchback_Price
                    WHEN pb.vehicle_type = 'SUV' THEN a.SUV_Price
                    WHEN pb.vehicle_type = 'Prime_SUV' THEN a.Prime_SUV_Price
                END as price
            FROM PastBookings pb
            LEFT JOIN AvailableTaxis a ON pb.pickup_location = a.pickup_location 
                AND pb.drop_location = a.drop_location
            WHERE pb.user_id IS NOT NULL
            ORDER BY pb.travel_date DESC
        `);
        
        // Combine all bookings
        const allBookingsData = [...allBookings, ...pastBookingsData];
        
        // Group bookings by user_id
        const bookingsMap = {};
        allBookingsData.forEach(booking => {
            if (!bookingsMap[booking.user_id]) {
                bookingsMap[booking.user_id] = [];
            }
            bookingsMap[booking.user_id].push(booking);
        });
        
        // Calculate total bookings across all users
        const totalBookingsCount = users.reduce((total, user) => {
            return total + parseInt(user.total_bookings) + (pastBookingsMap[user.user_id] || 0);
        }, 0);
        
        // Add booking data to each user
        const usersWithBookings = users.map(user => ({
            ...user,
            total_bookings: parseInt(user.total_bookings) + (pastBookingsMap[user.user_id] || 0),
            active_bookings: parseInt(user.active_bookings),
            past_bookings: pastBookingsMap[user.user_id] || 0,
            all_bookings: bookingsMap[user.user_id] || []
        }));
        
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
            'SELECT * FROM User WHERE user_id = ?',
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
            'UPDATE User SET name = ?, email = ?, mobile = ? WHERE user_id = ?',
            [name, email, mobile, userId]
        );

        // Fetch updated user data
        const [updatedUsers] = await pool.execute(
            'SELECT user_id, name, email, mobile FROM User WHERE user_id = ?',
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
        
        // Fetch booking data with user details and price information
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
                b.user_id,
                u.name as user_name,
                u.email as user_email,
                u.mobile as user_mobile,
                CASE 
                    WHEN b.vehicle_type = 'Sedan' THEN a.Sedan_Price
                    WHEN b.vehicle_type = 'Hatchback' THEN a.Hatchback_Price
                    WHEN b.vehicle_type = 'SUV' THEN a.SUV_Price
                    WHEN b.vehicle_type = 'Prime_SUV' THEN a.Prime_SUV_Price
                END as price
            FROM BookingTaxis b
            LEFT JOIN User u ON b.user_id = u.user_id
            LEFT JOIN AvailableTaxis a ON b.pickup_location = a.pickup_location 
                AND b.drop_location = a.drop_location
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
        
        // Fetch booking data with user details and price information
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
                COALESCE(u.name, 'Deleted User') as user_name,
                COALESCE(u.email, 'N/A') as user_email,
                COALESCE(u.mobile, 'N/A') as user_mobile,
                CASE 
                    WHEN b.vehicle_type = 'Sedan' THEN a.Sedan_Price
                    WHEN b.vehicle_type = 'Hatchback' THEN a.Hatchback_Price
                    WHEN b.vehicle_type = 'SUV' THEN a.SUV_Price
                    WHEN b.vehicle_type = 'Prime_SUV' THEN a.Prime_SUV_Price
                END as price
            FROM PastBookings b
            LEFT JOIN User u ON b.user_id = u.user_id
            LEFT JOIN AvailableTaxis a ON b.pickup_location = a.pickup_location 
                AND b.drop_location = a.drop_location
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

// Get past bookings with deleted users
router.get('/deleted-user-bookings', verifyAdmin, async (req, res) => {
    try {
        console.log('Fetching past bookings with deleted users...');
        
        // Fetch booking data with price information for deleted users
        const [deletedUserBookings] = await pool.execute(`
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
                'Deleted User' as user_name,
                'N/A' as user_email,
                'N/A' as user_mobile,
                CASE 
                    WHEN b.vehicle_type = 'Sedan' THEN a.Sedan_Price
                    WHEN b.vehicle_type = 'Hatchback' THEN a.Hatchback_Price
                    WHEN b.vehicle_type = 'SUV' THEN a.SUV_Price
                    WHEN b.vehicle_type = 'Prime_SUV' THEN a.Prime_SUV_Price
                END as price
            FROM PastBookings b
            LEFT JOIN AvailableTaxis a ON b.pickup_location = a.pickup_location 
                AND b.drop_location = a.drop_location
            WHERE b.user_id IS NULL
            ORDER BY b.booking_date DESC
        `);
        
        console.log(`Successfully fetched ${deletedUserBookings.length} bookings with deleted users`);
        
        // Send response
        return res.json({ 
            success: true, 
            data: deletedUserBookings,
            count: deletedUserBookings.length
        });
    } catch (error) {
        console.error('Error in deleted-user-bookings route:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch bookings with deleted users',
            error: error.message
        });
    }
});

// Delete user and handle related operations
router.delete('/users/delete/:userId', verifyAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const { reason } = req.body;
        const adminEmail = req.admin.email;

        // Validate reason
        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Reason for deletion is required"
            });
        }

        // Start a transaction
        await pool.query('START TRANSACTION');

        try {
            // 1. Get user details before deletion
            const [userDetails] = await pool.execute(
                'SELECT * FROM User WHERE user_id = ?',
                [userId]
            );

            if (userDetails.length === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            const user = userDetails[0];

            // 2. Get all active bookings for the user
            const [activeBookings] = await pool.execute(
                'SELECT * FROM BookingTaxis WHERE user_id = ? AND status = "confirmed"',
                [userId]
            );

            // 3. Update TaxiAvailabilityByDate for each booking
            for (const booking of activeBookings) {
                await pool.execute(
                    `UPDATE TaxiAvailabilityByDate 
                     SET available_count = available_count + 1
                     WHERE travel_date = ? 
                     AND vehicle_type = ?`,
                    [booking.travel_date, booking.vehicle_type]
                );
            }

            // 4. Move active bookings to PastBookings
            await pool.execute(
                `INSERT INTO PastBookings 
                 (booking_date, travel_date, vehicle_type, 
                  number_of_passengers, pickup_location, drop_location, 
                  user_id, status)
                 SELECT 
                    booking_date, travel_date, vehicle_type,
                    number_of_passengers, pickup_location, drop_location,
                    user_id, 'cancelled'
                 FROM BookingTaxis 
                 WHERE user_id = ?`,
                [userId]
            );

            // 5. Delete bookings from BookingTaxis
            await pool.execute(
                'DELETE FROM BookingTaxis WHERE user_id = ?',
                [userId]
            );

            // 6. Archive user data
            await pool.execute(
                `INSERT INTO userDeleted 
                 (user_id, name, email, mobile, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    user.user_id,
                    user.name,
                    user.email,
                    user.mobile,
                    user.created_at,
                    user.updated_at
                ]
            );

            // 7. Update PastBookings to set user_id to NULL
            await pool.execute(
                'UPDATE PastBookings SET user_id = NULL WHERE user_id = ?',
                [userId]
            );

            // 8. Delete user from User table
            await pool.execute(
                'DELETE FROM User WHERE user_id = ?',
                [userId]
            );

            // Commit the transaction
            await pool.query('COMMIT');

            return res.json({
                success: true,
                message: "User deleted successfully",
                data: {
                    userId: user.user_id,
                    name: user.name,
                    email: user.email,
                    reason: reason,
                    deletedBy: adminEmail,
                    cancelledBookings: activeBookings.length
                }
            });
        } catch (error) {
            // Rollback the transaction on error
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error in delete user route:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete user",
            error: error.message
        });
    }
});

module.exports = router; 