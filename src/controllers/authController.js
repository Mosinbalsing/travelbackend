const { registerUser,loginUser,adminLogin,getUserFromToken } = require("../services/userService");
const { UserModel } = require("../models/userModel"); // ✅ Import UserModel
const { User } = require("../models/userModel"); // ✅ Import User model

const register = async (req, res) => {
    const { username, name, email, mobile, password } = req.body;

    // ✅ Check for missing fields
    if (!username || !name || !email || !mobile || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // ✅ Create a new user instance
    const user = new UserModel({ username, name, email, mobile, password });

    try {
        const response = await registerUser(user);

        // ✅ Send only one response
        if (response.success) {
            return res.status(201).json(response);
        } else {
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Registration Error:", error);
        return res.status(500).json({ success: false, message: "Failed to register, please try again" });
    }
};


const login = async (req, res) => {
    const { email, password } = req.body;
    console.log("Login attempt for:", email);
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false,
            error: "Email and password are required",
            isAuthenticated: false,
            isLoggedIn: false,
            hasToken: false,
            isAdmin: false
        });
    }

    try {
        const response = await loginUser(email, password);
        console.log("Login response:", response);
        
        if (response.success) {
            // Set token in response header
            res.setHeader('Authorization', `Bearer ${response.data.token}`);
            
            return res.status(200).json({
                ...response,
                isAuthenticated: true,
                isLoggedIn: true,
                hasToken: true,
                isAdmin: true
            });
        } else {
            return res.status(401).json({
                ...response,
                isAuthenticated: false,
                isLoggedIn: false,
                hasToken: false,
                isAdmin: false
            });
        }
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Login failed", 
            error: error.message,
            isAuthenticated: false,
            isLoggedIn: false,
            hasToken: false,
            isAdmin: false
        });
    }
};

const adminLoginController = async (req, res) => {
    const { email, password } = req.body;
    console.log("Admin login attempt for:", email);
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false,
            error: "Email and password are required",
            isAuthenticated: false,
            isLoggedIn: false,
            hasToken: false,
            isAdmin: false
        });
    }

    try {
        const response = await adminLogin(email, password);
        console.log("Admin login response:", response);
        
        if (response.success) {
            // Set token in response header
            res.setHeader('Authorization', `Bearer ${response.data.token}`);
            
            return res.status(200).json({
                ...response,
                isAuthenticated: true,
                isLoggedIn: true,
                hasToken: true,
                isAdmin: true
            });
        } else {
            return res.status(401).json({
                ...response,
                isAuthenticated: false,
                isLoggedIn: false,
                hasToken: false,
                isAdmin: false
            });
        }
    } catch (error) {
        console.error("Admin Login Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Admin login failed", 
            error: error.message,
            isAuthenticated: false,
            isLoggedIn: false,
            hasToken: false,
            isAdmin: false
        });
    }
};

const getUserFromTokencontroller = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        const result = await getUserFromToken(token);

        if (result.error) {
            return res.status(result.status || 401).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            user: result.user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserByMobile = async (req, res) => {
    try {
        const { mobile } = req.params;
        
        // Input validation
        if (!mobile) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mobile number is required' 
            });
        }

        const user = await User.findOne({ where: { mobile } });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error in getUserByMobile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = { register , login , adminLoginController, getUserFromTokencontroller, getUserByMobile };
