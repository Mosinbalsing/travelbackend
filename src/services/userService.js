const { pool } = require("../config/db");
const bcrypt = require("bcryptjs"); // ✅ Correct import
const jwt = require("jsonwebtoken");
const JWT_SECRET = "qwertyuiop";

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

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

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

module.exports = { registerUser, loginUser }; // ✅ Correct export
