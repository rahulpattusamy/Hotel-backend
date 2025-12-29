const db = require("../db/database");

/**
 * GET PROFIT
 * URL: /api/billings/profit?filter=all|today|week|month
 */
exports.getProfit = (req, res) => {
  try {
    const { filter = "all" } = req.query;

    let whereClause = "";

    // ===== FILTER LOGIC =====
    if (filter === "today") {
      whereClause = `
        WHERE DATE(created_at) = DATE('now')
      `;
    }

    if (filter === "week") {
      whereClause = `
        WHERE created_at >= DATE('now', 'weekday 0', '-6 days')
      `;
    }

    if (filter === "month") {
      whereClause = `
        WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
      `;
    }

    // ===== MAIN QUERY =====
    const query = `
      SELECT 
        COALESCE(SUM(total_amount), 0) AS profit
      FROM billings
      ${whereClause}
    `;

    db.get(query, [], (err, row) => {
      if (err) {
        console.error("Profit query error:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch profit",
        });
      }

      return res.json({
        success: true,
        profit: Number(row.profit || 0),
        filter,
      });
    });

  } catch (error) {
    console.error("Profit controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
