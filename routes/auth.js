const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

/* ======================
   LOGIN (NO MIDDLEWARE)
====================== */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  db.get(
    "SELECT id, name, email, password, role, staff_id FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Database error" });
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // ================= STAFF LOGIN =================
      if (user.role === "staff") {
        db.get(
          "SELECT id, name, phone, status FROM staff WHERE id = ? AND status = 'active'",
          [user.staff_id],
          (err, staff) => {
            if (err) {
              return res.status(500).json({ message: "Database error" });
            }

            if (!staff) {
              return res.status(403).json({ message: "Staff inactive or not found" });
            }

            const token = jwt.sign(
              {
                id: user.id,
                role: "staff",
                staffId: staff.id,
                name: staff.name,
              },
              JWT_SECRET,
              { expiresIn: "24h" }
            );

            // 🔴 RETURN TOKEN IN JSON (IMPORTANT)
            return res.json({
              token,
              user: {
                id: user.id,
                role: "staff",
                staffId: staff.id,
                name: staff.name,
                phone: staff.phone,
              },
            });
          }
        );
      }

      // ================= ADMIN LOGIN =================
      else {
        const token = jwt.sign(
          {
            id: user.id,
            role: "admin",
            name: user.name,
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        return res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            role: "admin",
          },
        });
      }
    }
  );
});

/* ======================
   LOGOUT (DEV)
====================== */
router.post("/logout", (req, res) => {
  // Frontend will clear localStorage
  res.json({ message: "Logged out" });
});

/* ======================
   PROFILE (PROTECTED)
====================== */
router.get("/profile", requireAuth, (req, res) => {
  // STAFF PROFILE
  if (req.user.role === "staff" && req.user.staffId) {
    db.get(
      "SELECT id, name, phone, status FROM staff WHERE id = ?",
      [req.user.staffId],
      (err, staff) => {
        if (err) {
          return res.status(500).json({ message: "Error fetching staff profile" });
        }

        if (!staff) {
          return res.status(404).json({ message: "Staff not found" });
        }

        res.json({
          id: req.user.id,
          role: "staff",
          staffId: staff.id,
          name: staff.name,
          phone: staff.phone,
          status: staff.status,
        });
      }
    );
  } 
  // ADMIN PROFILE
  else {
    res.json(req.user);
  }
});

/* ======================
   STAFF LIST (PUBLIC)
====================== */
router.get("/staff-list", (req, res) => {
  db.all(
    "SELECT id, name FROM staff WHERE status = 'active' ORDER BY name",
    [],
    (err, staffList) => {
      if (err) {
        return res.status(500).json({ message: "Error fetching staff list" });
      }
      res.json(staffList);
    }
  );
});

/* ======================
   CHANGE PASSWORD
====================== */
router.put("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  db.get(
    "SELECT password FROM users WHERE id = ?",
    [req.user.id],
    async (err, user) => {
      if (err || !user) {
        return res.status(500).json({ message: "User not found" });
      }

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hash = await bcrypt.hash(newPassword, 10);

      db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [hash, req.user.id],
        function (err) {
          if (err || this.changes === 0) {
            return res.status(500).json({ message: "Password update failed" });
          }

          res.json({
            message: "Password changed successfully. Please login again.",
          });
        }
      );
    }
  );
});

module.exports = router;
