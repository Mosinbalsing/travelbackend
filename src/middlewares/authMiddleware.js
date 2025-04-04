const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "qwertyuiop"; // Fallback for development

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No authorization header.',
                isAuthenticated: false,
                isLoggedIn: false,
                hasToken: false
            });
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                isAuthenticated: false,
                isLoggedIn: false,
                hasToken: false
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Add user from payload to request
        req.user = decoded;
        
        // Add authentication status to response
        res.locals.auth = {
            isAuthenticated: true,
            isLoggedIn: true,
            hasToken: true
        };
        
        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            isAuthenticated: false,
            isLoggedIn: false,
            hasToken: false,
            error: error.message
        });
    }
};

module.exports = authMiddleware; 