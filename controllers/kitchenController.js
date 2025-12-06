const db = require("../db/database");

// ================= MENU ITEMS =================
exports.getMenuItems = (req, res) => {
  db.all("SELECT * FROM menu_items ORDER BY category, name", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getMenuItemById = (req, res) => {
  db.get("SELECT * FROM menu_items WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
};

exports.createMenuItem = (req, res) => {
  const { name, category, price, stock, status } = req.body;
  db.run(
    "INSERT INTO menu_items (name, category, price, stock, status) VALUES (?, ?, ?, ?, ?)",
    [name, category, price, stock, status || "Pending"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Menu item created" });
    }
  );
};

exports.updateMenuItem = (req, res) => {
  const { name, category, price, stock, status } = req.body;
  db.run(
    "UPDATE menu_items SET name=?, category=?, price=?, stock=?, status=? WHERE id=?",
    [name, category, price, stock, status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Menu item updated" });
    }
  );
};

exports.deleteMenuItem = (req, res) => {
  db.run("DELETE FROM menu_items WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Menu item deleted" });
  });
};

// ================= CATEGORIES =================
exports.getCategories = (req, res) => {
  db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createCategory = (req, res) => {
  const { name } = req.body;
  db.run("INSERT INTO categories (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: "Category created" });
  });
};
exports.deleteCategory = (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM categories WHERE id=?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Category deleted" });
  });
};

// ================= KITCHEN ORDERS =================
// controllers/kitchenController.js
exports.getKitchenOrders = (req, res) => {
  const query = `
    SELECT 
      ko.id,
      ko.quantity,
      ko.status,
      ko.created_at,
      ko.booking_id,
      r.room_number,
      c.name AS customer_name,
      mi.name AS item_name,
      mi.price AS price
    FROM kitchen_orders ko
    JOIN bookings b ON ko.booking_id = b.id
    JOIN rooms r ON ko.room_id = r.id
    JOIN customers c ON b.customer_id = c.id
    JOIN menu_items mi ON ko.item_id = mi.id
    ORDER BY ko.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};


exports.createKitchenOrder = (req, res) => {
  const { room_id, booking_id, item_id, quantity } = req.body;
  db.run(
    "INSERT INTO kitchen_orders (room_id, booking_id, item_id, quantity, status) VALUES (?, ?, ?, ?, ?)",
    [room_id, booking_id, item_id, quantity, "Pending"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Order added" });
    }
  );
};


exports.updateKitchenOrderStatus = (req, res) => {
  const { status } = req.body;
  db.run(
    "UPDATE kitchen_orders SET status=? WHERE id=?",
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Kitchen order status updated" });
    }
  );
};
