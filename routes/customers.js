const express = require("express");
const router = express.Router();
const db = require("../db/database");
const multer = require("multer");
const path = require("path");

// ================= MULTER CONFIG =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ================= GET ALL CUSTOMERS =================
router.get("/", (req, res) => {
  db.all("SELECT * FROM customers ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================= GET CUSTOMER BY ID =================
router.get("/:id", (req, res) => {
  db.get(
    "SELECT * FROM customers WHERE id = ?",
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

// ================= CREATE CUSTOMER =================
router.post("/", upload.single("document"), (req, res) => {
  const {
    name,
    contact,
    email,
    id_type,
    id_number,
    address,
    vehicle_no,
    dob,
  } = req.body;

  // 🔴 REQUIRED VALIDATION
  if (!name || !contact) {
    return res.status(400).json({
      message: "Name and mobile number are mandatory",
    });
  }

  const document = req.file ? `uploads/${req.file.filename}` : null;

  const query = `
    INSERT INTO customers
    (name, contact, email, id_type, id_number, address, vehicle_no, dob, document)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      name,
      contact,
      email || null,
      id_type || null,
      id_number || null,
      address || null,
      vehicle_no || null,
      dob || null,
      document,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Customer added" });
    }
  );
});

// ================= UPDATE CUSTOMER =================
router.put("/:id", upload.single("document"), (req, res) => {
  const {
    name,
    contact,
    email,
    id_type,
    id_number,
    address,
    vehicle_no,
    dob,
  } = req.body;

  // 🔴 REQUIRED VALIDATION
  if (!name || !contact) {
    return res.status(400).json({
      message: "Name and mobile number are mandatory",
    });
  }

  const document = req.file ? `uploads/${req.file.filename}` : null;

  let query = `
    UPDATE customers SET
      name = ?,
      contact = ?,
      email = ?,
      id_type = ?,
      id_number = ?,
      address = ?,
      vehicle_no = ?,
      dob = ?
  `;

  const params = [
    name,
    contact,
    email || null,
    id_type || null,
    id_number || null,
    address || null,
    vehicle_no || null,
    dob || null,
  ];

  if (document) {
    query += `, document = ?`;
    params.push(document);
  }

  query += ` WHERE id = ?`;
  params.push(req.params.id);

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Customer updated" });
  });
});

// ================= DELETE CUSTOMER =================
router.delete("/:id", (req, res) => {
  db.run("DELETE FROM customers WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Customer deleted" });
  });
});

module.exports = router;
