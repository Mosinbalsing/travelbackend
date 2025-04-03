const { pool } = require("../config/db");
const bcrypt = require("bcryptjs"); // ✅ Correct import
const jwt = require("jsonwebtoken");
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "qwertyuiop"; // Fallback for development

const registerUser = async (user) => {
  console.log(user);
  try {
    const hashPassword = await bcrypt.hash(user.password, 10); // ✅ Corrected variable name
    const query = `INSERT INTO users (username, name, email, mobile, password) VALUES (?, ?, ?, ?, ?)`;
    const values = [
      user.username,
      user.name,
      user.email,
      user.mobile,
      hashPassword,
    ];
    await pool.query(query, values);
    return { success: true, message: "User registered successfully" };
  } catch (error) {
    console.error(error); // ✅ Log the actual error
    return {
      success: false,
      message: "Registration failed, please try again!",
      error: error,
    };
  }
};

const loginUser = async (email, password) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    console.log("Email & Password from service:", email, password);
    console.log("Query result:", rows);

    if (rows.length === 0) {
      return { success: false, message: "User not found" };
    }

    const user = rows[0];
    console.log("User from database:", user);

    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log("Match", passwordMatch);

    if (!passwordMatch) {
      return { success: false, message: "Invalid password" };
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return { 
        success: false, 
        message: "Access denied. Admin privileges required.",
        isAdmin: false
      };
    }

    // Generate token with admin flag
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        name: user.name,
        isAdmin: true
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      message: "Admin login successful",
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          isAdmin: true
        }
      }
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message: "Login failed",
      error: error.message
    };
  }
};

// Add admin login function
const adminLogin = async (email, password) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? AND isAdmin = 1", [email]);
    
    if (rows.length === 0) {
      return { 
        success: false, 
        message: "Admin not found or access denied",
        isAdmin: false
      };
    }

    const admin = rows[0];
    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return { 
        success: false, 
        message: "Invalid admin credentials",
        isAdmin: false
      };
    }

    // Generate admin token
    const token = jwt.sign(
      { 
        userId: admin.id,
        email: admin.email,
        name: admin.name,
        isAdmin: true
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      message: "Admin login successful",
      data: {
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          mobile: admin.mobile,
          isAdmin: true
        }
      }
    };
  } catch (error) {
    console.error("Admin login error:", error);
    return {
      success: false,
      message: "Admin login failed",
      error: error.message,
      isAdmin: false
    };
  }
};

const getUserFromToken = async (token) => {
    try {
        if (!token) {
            throw new Error('No token provided');
        }

        // Verify the token using the correct JWT_SECRET
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return {
                    error: true,
                    message: 'Token has expired, please login again',
                    status: 401
                };
            }
            throw err;
        }

        // Get user from database
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.id]);

        if (users.length === 0) {
            throw new Error('User not found');
        }

        return { error: false, user: users[0] };
    } catch (error) {
        console.error('Error in getUserFromToken:', error);
        return { error: true, message: error.message, status: 500 };
    }
};

module.exports = { registerUser, loginUser, adminLogin, getUserFromToken }; // ✅ Correct export
