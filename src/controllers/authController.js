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

module.exports = { register , login , getUserFromTokencontroller };
