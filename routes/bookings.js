// routes/bookings.js  (replace existing file with this)
const express = require("express");
const router = express.Router();
const db = require("../db/database");

// ----------------- Helpers -----------------

// Produce an ISO-like string in IST (offset +05:30).
// Format: YYYY-MM-DDTHH:MM:SS+05:30
function getISTISOString(date = new Date()) {
  // convert date to UTC ms, then add IST offset (5.5 hours)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istMs = utc + 5.5 * 60 * 60 * 1000;
  const d = new Date(istMs);
  const pad = (n) => String(n).padStart(2, "0");
  const iso =
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds()) +
    "+05:30";
  return iso;
}

// Promisified db.run
const runQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

// Promisified db.get
const getQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

// Promisified db.all
const allQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

// ----------------- Routes -----------------

// GET all bookings
router.get("/", (req, res) => {
  const query = `
    SELECT 
      b.id,
      b.booking_id,
      b.check_in,
      b.check_out,
      b.status,
      b.price,
      c.name AS customer_name,
      c.contact AS customer_contact,
      r.room_number,
      r.category AS room_category
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN rooms r ON b.room_id = r.id
    ORDER BY b.id DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET booking by ID
router.get("/:id", (req, res) => {
  const query = `
    SELECT 
      b.id,
      b.booking_id,
      b.check_in,
      b.check_out,
      b.status,
      b.price,
      c.name AS customer_name,
      c.contact AS customer_contact,
      r.room_number,
      r.category AS room_category
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    JOIN rooms r ON b.room_id = r.id
    WHERE b.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// CREATE booking
router.post("/", async (req, res) => {
  try {
    const {
      booking_id,
      customer_id,
      room_id,
      check_in, // expected as ISO-like string or omitted
      check_out, // optional
      status,
      price,
    } = req.body;

    if (!booking_id || !customer_id || !room_id || !price) {
      return res
        .status(400)
        .json({ error: "booking_id, customer_id, room_id and price are required" });
    }

    // Ensure check_in/check_out are stored in IST: if provided, assume it's client local and convert,
    // otherwise set check_in = now in IST
    const checkInIST = check_in ? new Date(check_in) : new Date();
    const checkInStr = getISTISOString(checkInIST);
    const checkOutStr = check_out ? getISTISOString(new Date(check_out)) : null;

    const insertQuery = `
      INSERT INTO bookings 
        (booking_id, customer_id, room_id, check_in, check_out, status, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const bookingStatus = status || "Confirmed";

    // Insert booking
    const result = await runQuery(insertQuery, [
      booking_id,
      customer_id,
      room_id,
      checkInStr,
      checkOutStr,
      bookingStatus,
      price,
    ]);

    // Update room status based on booking status
    const roomStatus = bookingStatus === "Checked-in" ? "Occupied" : "Booked";
    await runQuery("UPDATE rooms SET status = ? WHERE id = ?", [
      roomStatus,
      room_id,
    ]);

    res.json({
      id: result.lastID,
      booking_id,
      message: "Booking created and room status updated",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create booking failed" });
  }
});

// UPDATE booking (only status update supported)
router.put("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "No valid fields provided" });
    }

    // Map booking status to room status
    const roomStatus =
      status === "Checked-in"
        ? "Occupied"
        : status === "Checked-out"
        ? "Available"
        : status === "Confirmed"
        ? "Booked"
        : "Available";

    // 1) Update booking status with a guard to avoid overwriting an already checked-out booking incorrectly
    const updateResult = await runQuery(
      "UPDATE bookings SET status = ? WHERE id = ?",
      [status, req.params.id]
    );

    // 2) Get room id for the booking
    const row = await getQuery("SELECT room_id FROM bookings WHERE id = ?", [
      req.params.id,
    ]);
    if (!row) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // 3) Update room status
    await runQuery("UPDATE rooms SET status = ? WHERE id = ?", [
      roomStatus,
      row.room_id,
    ]);

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// DELETE booking
router.delete("/:id", (req, res) => {
  db.run("DELETE FROM bookings WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Booking deleted" });
  });
});

/*
  CHECKOUT
  - Ensures IST timestamps
  - Aggregates kitchen orders by item
  - Prevents double checkout (race conditions)
  - Uses a transaction
  - Marks kitchen orders that are billed as "Settled"
  - Computes total_amount if not provided
*/
router.post("/:id/checkout", async (req, res) => {
  const bookingId = req.params.id;
  // Accept optional fields, but we'll compute if missing
  let { check_out, add_ons, total_amount } = req.body;

  // Normalize add_ons: should be an array of {name, price} or [{description, amount}]
  if (!add_ons) add_ons = [];
  if (!Array.isArray(add_ons)) {
    // try to parse if string
    try {
      add_ons = JSON.parse(add_ons);
      if (!Array.isArray(add_ons)) add_ons = [];
    } catch (e) {
      add_ons = [];
    }
  }

  // check_out time: if provided, convert; else take IST now
  const istCheckOutStr = check_out ? getISTISOString(new Date(check_out)) : getISTISOString();

  // we'll perform a serialized transaction to avoid races
  db.serialize(async () => {
    try {
      await runQuery("BEGIN TRANSACTION");

      // 1) Fetch booking (fresh)
      const booking = await getQuery("SELECT * FROM bookings WHERE id = ?", [
        bookingId,
      ]);
      if (!booking) {
        await runQuery("ROLLBACK");
        return res.status(404).json({ error: "Booking not found" });
      }

      // Prevent double checkout: check current booking.status
      if (booking.status === "Checked-out") {
        await runQuery("ROLLBACK");
        return res.status(400).json({ error: "Booking already checked out" });
      }

      // 2) Update booking to Checked-out (but ensure we only update if not already checked-out)
      const updateBookingRes = await runQuery(
        "UPDATE bookings SET status = 'Checked-out', check_out = ? WHERE id = ? AND status != 'Checked-out'",
        [istCheckOutStr, bookingId]
      );

      // check whether the update affected a row
      // sqlite3 doesn't return affectedRows via this.lastID; but `this.changes` would be available in callback.
      // Our runQuery resolves with `this`. We can check `updateBookingRes.changes`
      if (typeof updateBookingRes.changes !== "undefined" && updateBookingRes.changes === 0) {
        // nothing was changed -> probably concurrently checked out
        await runQuery("ROLLBACK");
        return res.status(409).json({ error: "Checkout conflict: booking status unchanged" });
      }

      // 3) Update room status to Available
      await runQuery("UPDATE rooms SET status = 'Available' WHERE id = ?", [
        booking.room_id,
      ]);

      // 4) Gather kitchen orders to include in billing
      // We identify kitchen orders by: same room_id AND created_at between booking.check_in and current checkout time
      // AND status IN ('Pending','Served') — i.e., not already settled.
      //
      // NOTE: this approach relies on kitchen_orders.created_at being stored in the same ISO format
      // and booking.check_in being stored in IST ISO. If you later add booking_id FK on kitchen_orders,
      // you should prefer that.
      const kitchenOrderRows = await allQuery(
        `SELECT ko.id AS ko_id, ko.item_id, ko.quantity, ko.created_at, mi.name AS item_name, mi.price AS item_price
         FROM kitchen_orders ko
         JOIN menu_items mi ON ko.item_id = mi.id
         WHERE ko.room_id = ?
           AND ko.status IN ('Pending','Served')
           AND (ko.created_at >= ? AND ko.created_at <= ?)
        `,
        [booking.room_id, booking.check_in, istCheckOutStr]
      );

      // Aggregate kitchen orders by item_id (summing quantities)
      const aggregatedKitchen = {};
      for (const k of kitchenOrderRows) {
        const key = k.item_id;
        if (!aggregatedKitchen[key]) {
          aggregatedKitchen[key] = {
            item_id: k.item_id,
            item_name: k.item_name,
            item_price: Number(k.item_price) || 0,
            quantity: Number(k.quantity) || 0,
          };
        } else {
          aggregatedKitchen[key].quantity += Number(k.quantity) || 0;
        }
      }

      const kitchenOrdersForBilling = Object.values(aggregatedKitchen);

      // 5) Compute amounts if total_amount not provided
      // Sum room price (booking.price) + kitchen orders + add_ons
      let computedKitchenTotal = 0;
      for (const k of kitchenOrdersForBilling) {
        computedKitchenTotal += k.quantity * (Number(k.item_price) || 0);
      }

      // Normalize add_ons: expect items like {description, amount}
      let computedAddOnsTotal = 0;
      const normalizedAddOns = [];
      for (const a of add_ons) {
        // accept either {description, amount} or {name, price} shape
        const description = a.description || a.name || a.label || "Add-on";
        const amount = Number(a.amount ?? a.price ?? 0) || 0;
        normalizedAddOns.push({ description, amount });
        computedAddOnsTotal += amount;
      }

      // Booking room_price: try to take booking.price, fallback to 0
      const roomPrice = Number(booking.price) || 0;

      // Final total
      if (typeof total_amount === "undefined" || total_amount === null) {
        total_amount = roomPrice + computedKitchenTotal + computedAddOnsTotal;
      } else {
        total_amount = Number(total_amount) || roomPrice + computedKitchenTotal + computedAddOnsTotal;
      }

      // 6) Insert into billings
      const insertBillingQuery = `
        INSERT INTO billings
          (booking_id, customer_id, room_id, check_in, check_out, room_price, add_ons, kitchen_orders, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await runQuery(insertBillingQuery, [
        booking.id, // internal numeric id; if you want public booking_id, change to booking.booking_id
        booking.customer_id,
        booking.room_id,
        booking.check_in,
        istCheckOutStr,
        roomPrice,
        JSON.stringify(normalizedAddOns),
        JSON.stringify(kitchenOrdersForBilling),
        total_amount,
      ]);

      // 7) Mark included kitchen orders as 'Settled' so they won't be included again on future checkout
      if (kitchenOrderRows.length > 0) {
        const kitchenIds = kitchenOrderRows.map((r) => r.ko_id);
        // Build placeholders for SQL
        const placeholders = kitchenIds.map(() => "?").join(",");
        await runQuery(
          `UPDATE kitchen_orders SET status = 'Settled' WHERE id IN (${placeholders})`,
          kitchenIds
        );
      }

      await runQuery("COMMIT");

      // Return a clear billing summary
      res.json({
        message: "Checked out successfully",
        billing_summary: {
          booking_id: booking.booking_id,
          booking_db_id: booking.id,
          room_id: booking.room_id,
          check_in: booking.check_in,
          check_out: istCheckOutStr,
          room_price: roomPrice,
          add_ons: normalizedAddOns,
          kitchen_orders: kitchenOrdersForBilling,
          total_amount,
        },
      });
    } catch (err) {
      console.error("Checkout error:", err);
      try {
        await runQuery("ROLLBACK");
      } catch (rerr) {
        console.error("Rollback error:", rerr);
      }
      res.status(500).json({ error: "Checkout failed" });
    }
  });
});

module.exports = router;
