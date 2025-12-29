const db = require("../db/database");

/* ================= ADD EXPENSE ================= */
exports.createExpense = (req, res) => {
  const { title, amount, category, expense_date } = req.body;

  if (!title || !amount || !expense_date) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  db.run(
  `INSERT INTO expenses (title, amount, category, expense_date, created_at)
   VALUES (?, ?, ?, ?, datetime('now'))`,
  [title, amount, category || null, expense_date],
  function (err) {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ message: "Failed to add expense" });
    }

    res.status(201).json({
      id: this.lastID,
      title,
      amount,
      category,
      expense_date,
    });
  }
);

};



exports.getExpenses = (req, res) => {
  const { filter } = req.query;

  let query = `SELECT * FROM expenses`;
  let params = [];

  if (filter === "today") {
    query += ` WHERE date(expense_date) = date('now')`;
  } 
  else if (filter === "week") {
    query += `
      WHERE date(expense_date) >= date('now', '-6 days')
      AND date(expense_date) <= date('now')
    `;
  } 
  else if (filter === "month") {
    query += `
      WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
    `;
  }

  query += ` ORDER BY expense_date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("DB ERROR:", err);
      return res.status(500).json({ message: "Failed to fetch expenses" });
    }
    res.json(rows);
  });
};


exports.deleteExpense = (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM expenses WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Delete failed" });
      }
      res.json({ message: "Expense deleted" });
    }
  );
};
