const { pool } = require("../config/db");
const bcrypt = require("bcryptjs"); // ✅ Correct import
const jwt = require("jsonwebtoken");
const JWT_SECRET = "qwertyuiop"; // Keep it consistent


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
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    console.log("Email & Password from service:", email, password);
    console.log("Query result:", rows);

    if (rows.length === 0) {
      return { success: false, message: "User not found" };
    }

    const user = rows[0];
    console.log("User from database:", user);

    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log("Match",passwordMatch);
    

    if (!passwordMatch) {
      return { success: false, message: "Invalid password" };
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);




    return { success: true, message: "Login successful", token };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message: "Login failed, please try again!",
      error: error.message,
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


module.exports = { registerUser, loginUser, getUserFromToken }; // ✅ Correct export
