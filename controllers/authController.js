const db = require("../db/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;


exports.login = (req, res) => {
  const { email, password } = req.body;

  // 1️⃣ Validate input
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password required",
    });
  }

  // 2️⃣ Find user
  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "Database error",
        });
      }

      if (!user) {
        return res.status(401).json({
          message: "Invalid credentials",
        });
      }

      // 3️⃣ Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          message: "Invalid credentials",
        });
      }

      // 4️⃣ Create token
      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // 5️⃣ Send cookie + response
      res
        .cookie("token", token, {
          httpOnly: true,
          sameSite: "strict",
        })
        .json({
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
          },
        });
    }
  );
};


exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  // 1️⃣ Validate
  if (!name || !email || !password || !role) {
    return res.status(400).json({
      message: "All fields are required",
    });
  }

  if (!["admin", "staff"].includes(role)) {
    return res.status(400).json({
      message: "Invalid role",
    });
  }

  // 2️⃣ Check existing user
  db.get(
    "SELECT id FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "Database error",
        });
      }

      if (user) {
        return res.status(409).json({
          message: "Email already registered",
        });
      }

      // 3️⃣ Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4️⃣ Insert user
      db.run(
        `INSERT INTO users (name, email, password, role)
         VALUES (?, ?, ?, ?)`,
        [name, email, hashedPassword, role],
        function (err) {
          if (err) {
            return res.status(500).json({
              message: "User registration failed",
            });
          }

          res.status(201).json({
            message: "User registered successfully",
            user: {
              id: this.lastID,
              name,
              email,
              role,
            },
          });
        }
      );
    }
  );
};

exports.logout = (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      sameSite: "lax", // 🔥 MUST MATCH LOGIN
    })
    .json({ message: "Logged out" });
};

exports.profile = (req, res) => {
  db.get(
    "SELECT id, name, role FROM users WHERE id = ?",
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "Failed to load profile",
        });
      }

      if (!user) {
        return res.status(401).json({
          message: "User not found",
        });
      }

      res.json(user);
    }
  );
};