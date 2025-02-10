const { registerUser,loginUser,getUserFromToken } = require("../services/userService");
const { UserModel } = require("../models/userModel"); // ✅ Import UserModel

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
    // ✅ Add login logic here
    const { email, password } = req.body;
    console.log(email, password);
    
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    try {
        const response = await loginUser(email, password);
        console.log(response);
        
        if (response.success) {
            return res.status(201).json(response);
        } else {
            return res.status(400).json(response);
        }
    } catch (error) {
        console.error("Registration Error:", error);
        return res.status(500).json({ success: false, message: "Failed to login, please try again" });
    }
};

const getUserFromTokencontroller = async (req, res) => {
    try {
        // First check if headers exist at all
        if (!req.headers) {
            return res.status(401).json({ success: false, message: "No headers found in request" });
        }

        // Then check authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: "Authorization header is missing" });
        }

        // Check if it's a Bearer token
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: "Invalid token format. Use 'Bearer <token>'" });
        }

        const token = authHeader.split(' ')[1];
        const response = await getUserFromToken(token); // Using the service function
        
        if (response.success) {
            return res.status(200).json(response);
        } else {
            return res.status(401).json(response);
        }
    } catch (error) {
        console.error("Token Verification Error:", error);
        return res.status(500).json({ success: false, message: "Failed to verify token" });
    }
};

module.exports = { register , login , getUserFromTokencontroller };
