const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/* GET ALL STAFF */
router.get("/", requireAuth, requireAdmin, (req, res) => {
  db.all(
    `
    SELECT
      s.id,
      s.name,
      s.phone,
      s.status,
      s.created_at,
      u.email
    FROM staff s
    LEFT JOIN users u ON u.staff_id = s.id AND u.role = 'staff'
    ORDER BY s.created_at DESC
    `,

    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({ message: "Failed to fetch staff" });
      res.json(rows);
    }
  );
});

/* ADD STAFF (AUTO CREATE USER LOGIN) */
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({
      message: "Name, phone number and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters",
    });
  }


  try {
    // 1️⃣ Insert into staff table
    db.run(
      `INSERT INTO staff (name, phone, status)
       VALUES (?, ?, 'active')`,
      [name.trim(), phone || null],
      async function (err) {
        if (err)
          return res.status(500).json({ message: "Failed to add staff" });

        const staffId = this.lastID;

        // 2️⃣ Auto-generate email
        const email = `staff${staffId}@hotel.com`;

        // 3️⃣ Use admin-set password or fallback to default
        const passwordHash = await bcrypt.hash(password, 10);


        // 4️⃣ Insert into users table
        db.run(
          `INSERT INTO users (name, email, password, role, staff_id)
           VALUES (?, ?, ?, 'staff', ?)`,
          [name.trim(), email, passwordHash, staffId],
          (err2) => {
            if (err2) {
              return res.status(500).json({
                message: "Staff added but login creation failed",
              });
            }

            // ✅ Final response (UI does not need email/password)
            res.json({
              id: staffId,
              name,
              phone,
              status: "active",
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
