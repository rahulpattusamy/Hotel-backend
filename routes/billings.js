const express = require("express");
const router = express.Router();
const db = require("../db/database");

// GET all bills
router.get("/", (req, res) => {
  const query = `
    SELECT *
    FROM billings
    ORDER BY id DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET bill by ID
router.get("/:id", (req, res) => {
  db.get("SELECT * FROM billings WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

module.exports = router;
