const express = require("express");
const router = express.Router();
const db = require("../db/database");
const billingController = require("../controllers/profitController");

/* ===============================
   GET TOTAL PROFIT
   URL: /api/billings/profit
================================ */
router.get("/profit", billingController.getProfit);

/* ===============================
   GET ALL BILLS
   URL: /api/billings
================================ */
router.get("/", (req, res) => {
  const query = `
  SELECT 
  b.id AS bill_id,
  b.booking_id AS booking_db_id,
  bk.booking_id AS booking_code,
  c.name AS customer_name,
  b.room_id,
  b.total_amount,
  b.created_at
FROM billings b
JOIN bookings bk ON b.booking_id = bk.id
LEFT JOIN customers c ON b.customer_id = c.id
ORDER BY b.created_at DESC;`;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("FETCH BILLINGS ERROR:", err);
      return res.status(500).json(err);
    }
    res.json(rows);
  });
});


/* ===============================
   GET SINGLE BILL + DETAILS
   URL: /api/billings/:id
================================ */
router.get("/:id", (req, res) => {
  const billId = req.params.id;

  db.get(
    `
    SELECT 
      b.*,
      c.name AS customer_name
    FROM billings b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN rooms r ON b.room_id = r.id
    WHERE b.id = ?
    `,
    [billId],
    (err, bill) => {
      if (err) {
        console.error("❌ BILL QUERY FAILED:", err);
        return res.status(500).json({ error: err.message });
      }

      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      // ROOM ADD-ONS
      let roomAddOns = [];
      if (bill.room_add_ons) {
        try {
          const parsed = JSON.parse(bill.room_add_ons);
          if (typeof parsed === "object") {
            roomAddOns = Object.entries(parsed)
              .filter(([_, price]) => Number(price) > 0)
              .map(([name, price]) => ({
                name,
                qty: 1,
                price: Number(price),
              }));
          }
        } catch (e) {
          console.error("❌ ROOM ADD-ONS PARSE FAILED:", e);
        }
      }

      // KITCHEN ORDERS
      db.all(
        `
        SELECT 
          mi.name AS item_name,
          ko.quantity,
          mi.price
        FROM kitchen_orders ko
        JOIN menu_items mi ON ko.item_id = mi.id
        WHERE ko.booking_id = ?
        `,
        [bill.booking_id],
        (err, kitchenOrders) => {
          if (err) {
            console.error("❌ KITCHEN ORDERS FAILED:", err);
            return res.status(500).json({ error: err.message });
          }

          res.json({
            ...bill,
            add_ons: roomAddOns,
            kitchen_orders: kitchenOrders,
          });
        }
      );
    }
  );
});

module.exports = router;
