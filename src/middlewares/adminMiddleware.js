const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "qwertyuiop";

const adminMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No authorization header.',
                isAuthenticated: false,
                isLoggedIn: false,
                hasToken: false,
                isAdmin: false
            });
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                isAuthenticated: false,
                isLoggedIn: false,
                hasToken: false,
                isAdmin: false
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user is admin
        if (!decoded.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.',
                isAuthenticated: true,
                isLoggedIn: true,
                hasToken: true,
                isAdmin: false
            });
        }
        
        // Add user from payload to request
        req.user = decoded;
        
        // Add authentication status to response
        res.locals.auth = {
            isAuthenticated: true,
            isLoggedIn: true,
            hasToken: true,
            isAdmin: true
        };
        
        next();
    } catch (error) {
        console.error('Admin Middleware Error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            isAuthenticated: false,
            isLoggedIn: false,
            hasToken: false,
            isAdmin: false,
            error: error.message
        });
    }
};

module.exports = adminMiddleware; 