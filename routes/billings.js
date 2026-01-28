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
      b.booking_id,
      b.customer_id,
      c.name AS customer_name,
      b.room_id,
      b.advance_paid,
      b.total_amount,
      b.created_at,
      b.billed_by_name,
      b.billed_by_role
    FROM billings b
    JOIN customers c ON b.customer_id = c.id
    ORDER BY b.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ FETCH BILLS FAILED:", err);
      return res.status(500).json({ error: err.message });
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

      console.log("✅ BILL FOUND:", bill.id);

      /* ===============================
        ADD-ONS (FROM billings.add_ons)
      ================================ */
      let roomAddOns = [];

      try {
        if (bill.add_ons) {
          const parsed =
            typeof bill.add_ons === "string"
              ? JSON.parse(bill.add_ons)
              : bill.add_ons;

          roomAddOns = Array.isArray(parsed)
            ? parsed.map(a => ({
                name: a.description,
                qty: 1,
                price: Number(a.amount) || 0
              }))
            : [];
        }
      } catch (e) {
        console.error("❌ ADD-ONS PARSE FAILED:", bill.add_ons);
        roomAddOns = [];
      }

      console.log("✅ ADD-ONS SENT TO FRONTEND:", roomAddOns);


      /* ===============================
         KITCHEN ORDERS
      ================================ */
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
      [bill.booking_id], // ✅ STRING

        (err, kitchenOrders) => {
          if (err) {
            console.error("❌ KITCHEN ORDERS FAILED:", err);
            return res.status(500).json({ error: err.message });
          }

          console.log("✅ KITCHEN ORDERS OK");

          /* ===============================
             FINAL RESPONSE
          ================================ */
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
