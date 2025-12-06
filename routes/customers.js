const express = require("express");
const router = express.Router();
const db = require("../db/database");

// GET all customers
router.get("/", (req, res) => {
  db.all("SELECT * FROM customers ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET customer by ID
router.get("/:id", (req, res) => {
  db.get("SELECT * FROM customers WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// POST create customer
router.post("/", (req, res) => {
  const { name, contact, email, id_type, id_number, address } = req.body;

  const query = `
    INSERT INTO customers (name, contact, email, id_type, id_number, address) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [name, contact, email, id_type, id_number, address],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Customer added" });
    }
  );
});

// PUT update customer
router.put("/:id", (req, res) => {
  const { name, contact, email, id_type, id_number, address } = req.body;

  const query = `
    UPDATE customers SET 
      name = ?, 
      contact = ?, 
      email = ?, 
      id_type = ?, 
      id_number = ?,
      address = ?
    WHERE id = ?
  `;

  db.run(
    query,
    [name, contact, email, id_type, id_number, address, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Customer updated" });
    }
  );
});

// DELETE customer
router.delete("/:id", (req, res) => {
  db.run("DELETE FROM customers WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Customer deleted" });
  });
});

module.exports = router;
