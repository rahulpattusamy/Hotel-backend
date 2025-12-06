const db = require("../db/database");

exports.getAllRooms = (req, res) => {
  db.all("SELECT * FROM rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const rooms = rows.map(r => ({ ...r, amenities: JSON.parse(r.amenities), add_ons: JSON.parse(r.add_ons) }));
    res.json(rooms);
  });
};

exports.getRoomById = (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM rooms WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Room not found" });
    res.json({ ...row, amenities: JSON.parse(row.amenities), add_ons: JSON.parse(row.add_ons) });
  });
};

exports.createRoom = (req, res) => {
  const { room_number, category, status, price_per_night, amenities, add_ons } = req.body;
  db.run(
    `INSERT INTO rooms (room_number, category, status, price_per_night, amenities, add_ons)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [room_number, category, status, price_per_night, JSON.stringify(amenities || {}), JSON.stringify(add_ons || {})],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
};

exports.updateRoom = (req, res) => {
  const { id } = req.params;
  const { room_number, category, status, price_per_night, amenities, add_ons } = req.body;
  db.run(
    `UPDATE rooms SET room_number=?, category=?, status=?, price_per_night=?, amenities=?, add_ons=? WHERE id=?`,
    [room_number, category, status, price_per_night, JSON.stringify(amenities || {}), JSON.stringify(add_ons || {}), id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Room not found" });
      res.json({ updated: true });
    }
  );
};
exports.getActiveRooms = (req, res) => {
  const query = `
    SELECT 
      r.id AS room_id,
      r.room_number,
      b.id AS booking_id,
      c.name AS customer_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN customers c ON b.customer_id = c.id
    WHERE b.status IN ('Confirmed', 'Checked-in')
    ORDER BY r.room_number
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};


exports.deleteRoom = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM rooms WHERE id=?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Room not found" });
    res.json({ deleted: true });
  });
};
