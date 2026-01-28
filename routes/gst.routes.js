const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");

// ===============================
// GET GST SETTINGS
// ===============================
router.get("/", requireAuth, (req, res) => {
  db.all("SELECT * FROM gst_settings", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ===============================
// UPDATE GST SETTINGS
// ===============================
router.put("/", requireAuth, (req, res) => {
  const settings = req.body;

  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: "Invalid GST payload format" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const query = `
      UPDATE gst_settings
      SET gst_rate = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE category = ?
    `;

    settings.forEach((s) => {
      db.run(
        query,
        [
          Number(s.gst_rate) || 0,
          s.is_enabled ? 1 : 0,
          s.category,
        ],
        function (err) {
          if (err) {
            console.error("GST update error:", err.message);
          } else {
            console.log(
              `GST updated: ${s.category} → rows affected: ${this.changes}`
            );
          }
        }
      );
    });

    db.run("COMMIT", (err) => {
      if (err) {
        console.error("GST commit failed:", err.message);
        return res.status(500).json({ error: "Failed to save GST settings" });
      }

      res.json({ message: "GST settings updated successfully" });
    });
  });
});


module.exports = router;
