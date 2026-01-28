const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");

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
//IMPORTANT: Order matters! Specific routes BEFORE generic routes

// GET - BOOKINGS FOR CALENDAR VIEW
// IMPORTANT: Must be before /:id routes
router.get("/calendar", requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT
        b.id,
        b.booking_id,
        b.room_id,   
        datetime(b.check_in)  AS check_in,
        datetime(b.check_out) AS check_out,
        b.status,
        r.room_number
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.status IN ('Confirmed', 'Checked-in')
      ORDER BY b.check_in ASC
    `;

    const rows = await allQuery(query);
    res.json(rows);
  } catch (err) {
    console.error("Calendar fetch error:", err);
    res.status(500).json({ error: "Failed to load calendar bookings" });
  }
});

// GET all bookings (WITH CREATOR INFO)
router.get("/", requireAuth, (req, res) => {
  const query = `
    SELECT 
      b.id,
      b.booking_id,
      b.check_in,
      b.check_out,
      b.status,
      b.price,
      b.advance_paid, 
      b.add_ons,
      b.people_count,
      b.created_by_id,
      b.created_by_name,
      b.created_by_role,
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

// POST - CREATE booking
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      booking_id,
      customer_id,
      room_id,
      check_in,
      check_out,
      status,
      price,
      add_ons, 
      people_count = 1,
    } = req.body;

    // ✅ Get creator info from JWT token
    // ✅ Get creator info from JWT
    const created_by_id = req.user.id;
    const created_by_role = req.user.role;

    let created_by_name = null;

    // Resolve creator name correctly
    if (created_by_role === "admin") {
      const admin = await getQuery(
        "SELECT name FROM users WHERE id = ?",
        [created_by_id]
      );
      created_by_name = admin?.name || "Admin";
    }

    if (created_by_role === "staff") {
      const staff = await getQuery(
        "SELECT s.name FROM users u JOIN staff s ON u.staff_id = s.id WHERE u.id = ?",
        [created_by_id]
      );
      created_by_name = staff?.name || "Staff";
    }

    console.log("📝 Creating booking by:", {
      created_by_id,
      created_by_name,
      created_by_role,
    });

    if (!booking_id || !customer_id || !room_id || !price) {
      return res.status(400).json({ 
        error: "booking_id, customer_id, room_id and price are required" 
      });
    }

    const checkInStr = check_in || new Date().toISOString().slice(0, 19);
    const checkOutStr = check_out || null;

    if (check_out && new Date(check_out) <= new Date(check_in)) {
      return res.status(400).json({
        error: "Check-out must be after check-in",
      });
    }

    // Capacity validation
    const room = await getQuery(
      "SELECT capacity FROM rooms WHERE id = ?",
      [room_id]
    );

    if (!room) {
      return res.status(400).json({ error: "Invalid room selected" });
    }

    // if (Number(people_count) > Number(room.capacity)) {
    //   return res.status(400).json({
    //     error: `Room capacity exceeded. Max allowed: ${room.capacity}`,
    //   });
    // }


    // 🔒 Check room availability for selected dates
    const availabilityQuery = `
      SELECT COUNT(*) as conflictCount
      FROM bookings
      WHERE room_id = ?
        AND status IN ('Confirmed', 'Checked-in')
        AND (
          check_in < ?
          AND (check_out IS NULL OR check_out > ?)
        )
    `;

    const availability = await getQuery(availabilityQuery, [
      room_id,
      checkOutStr || checkInStr, // new booking checkout
      checkInStr                // new booking checkin
    ]);

    if (availability.conflictCount > 0) {
      return res.status(409).json({
        error: `Room is not available between ${checkInStr} and ${checkOutStr}`
      });
    }

    // Fetch room price to calculate advance
    const roomDetails = await getQuery(
      "SELECT price_per_night FROM rooms WHERE id = ?",
      [room_id]
    );

    if (!roomDetails) {
      return res.status(400).json({ error: "Invalid room selected" });
    }

    const advance_paid =
      req.body.advance_paid === "" ||
      req.body.advance_paid === null ||
      typeof req.body.advance_paid === "undefined"
        ? 0
        : Number(req.body.advance_paid);


    const insertQuery = `
      INSERT INTO bookings 
        (booking_id, customer_id, room_id, check_in, check_out, status, price, add_ons, people_count, advance_paid, created_by_id, created_by_name, created_by_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(add_ons || []), 
      Number(people_count),
      advance_paid,
      created_by_id,
      created_by_name,
      created_by_role
    ]);

    // Update room status
    const roomStatus = bookingStatus === "Checked-in" ? "Occupied" : "Booked";
    await runQuery("UPDATE rooms SET status = ? WHERE id = ?", [
      roomStatus,
      room_id,
    ]);

    console.log("✅ Booking created successfully by:", created_by_name);

    res.json({
      id: result.lastID,
      booking_id,
      created_by_name,
      created_by_role,
      message: "Booking created and room status updated",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create booking failed" });
  }
});

// POST - CHECKOUT (MUST BE BEFORE /:id routes)
router.post("/:id/checkout", requireAuth, async (req, res) => {
  const bookingId = req.params.id;
  
  console.log("Checkout request received for booking ID:", bookingId);
  console.log("Request body:", req.body);
  
  let { check_out, add_ons, total_amount } = req.body;

  if (!add_ons) add_ons = [];
  if (!Array.isArray(add_ons)) {
    try {
      add_ons = JSON.parse(add_ons);
      if (!Array.isArray(add_ons)) add_ons = [];
    } catch (e) {
      add_ons = [];
    }
  }

  db.serialize(async () => {
    try {
      await runQuery("BEGIN TRANSACTION");

      // 1) Fetch booking
      const booking = await getQuery("SELECT * FROM bookings WHERE id = ?", [
        bookingId,
      ]);
      
      if (!booking) {
        await runQuery("ROLLBACK");
        return res.status(404).json({ error: "Booking not found" });
      }

      console.log("Booking found:", booking.booking_id);

      // Prevent double checkout
      if (booking.status === "Checked-out") {
        await runQuery("ROLLBACK");
        return res.status(400).json({ error: "Booking already checked out" });
      }
      // Decide checkout time
      const finalCheckoutTime = booking.check_out
        ? booking.check_out        // 🟢 booking-time checkout
        : new Date().toISOString(); // 🟢 real checkout click time


      // 2) Update booking to Checked-out
      const updateBookingRes = await runQuery(
        "UPDATE bookings SET status = 'Checked-out', check_out = ? WHERE id = ? AND status != 'Checked-out'",
        [finalCheckoutTime, bookingId]
      );

      if (typeof updateBookingRes.changes !== "undefined" && updateBookingRes.changes === 0) {
        await runQuery("ROLLBACK");
        return res.status(409).json({ error: "Checkout conflict: booking status unchanged" });
      }

      console.log("Booking status updated to Checked-out");

      // 3) Update room status to Available
      await runQuery("UPDATE rooms SET status = 'Available' WHERE id = ?", [
        booking.room_id,
      ]);

      console.log("Room status updated to Available");

      // 4) Gather kitchen orders
      const kitchenOrderRows = await allQuery(
        `SELECT 
          ko.id AS ko_id,
          ko.item_id,
          ko.quantity,
          mi.name AS item_name,
          mi.price AS item_price
        FROM kitchen_orders ko
        JOIN menu_items mi ON ko.item_id = mi.id
        WHERE ko.booking_id = ?
          AND ko.status IN ('Pending','Served')`,
        [booking.booking_id]
      );

      console.log(`Found ${kitchenOrderRows.length} kitchen orders`);

      // Aggregate kitchen orders
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

      // 5) Compute amounts
      let computedKitchenTotal = 0;
      for (const k of kitchenOrdersForBilling) {
        computedKitchenTotal += k.quantity * (Number(k.item_price) || 0);
      }

      let computedAddOnsTotal = 0;
      const normalizedAddOns = [];
      for (const a of add_ons) {
        const description = a.description || a.name || a.label || "Add-on";
        const amount = Number(a.amount ?? a.price ?? 0) || 0;
        normalizedAddOns.push({ description, amount });
        computedAddOnsTotal += amount;
      }

      const roomPrice = Number(booking.price) || 0;

      if (typeof total_amount === "undefined" || total_amount === null) {
        total_amount = roomPrice + computedKitchenTotal + computedAddOnsTotal;
      } else {
        total_amount = Number(total_amount) || roomPrice + computedKitchenTotal + computedAddOnsTotal;
      }

      console.log("Billing calculation:", {
        roomPrice,
        addOnsTotal: computedAddOnsTotal,
        kitchenTotal: computedKitchenTotal,
        total_amount
      });

      // 🔹 Resolve billed by (from JWT ONLY)
      const billed_by_id = req.user.id;
      const billed_by_role = req.user.role;

      let billed_by_name;

      if (billed_by_role === "admin") {
        const admin = await getQuery(
          "SELECT name FROM users WHERE id = ?",
          [billed_by_id]
        );

        if (!admin) throw new Error("Admin not found");
        billed_by_name = admin.name;
      }

      if (billed_by_role === "staff") {
        const staff = await getQuery(
          `
          SELECT s.name
          FROM users u
          JOIN staff s ON u.staff_id = s.id
          WHERE u.id = ?
          `,
          [billed_by_id]
        );

        if (!staff) throw new Error("Staff not found");
        billed_by_name = staff.name;
      }




      // 6) Insert into billings
      const insertBillingQuery = `
        INSERT INTO billings
          (booking_id, customer_id, room_id, check_in, check_out, room_price, advance_paid, add_ons, kitchen_orders, total_amount, billed_by_id, billed_by_name, billed_by_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await runQuery(insertBillingQuery, [
        booking.booking_id,
        booking.customer_id,
        booking.room_id,
        booking.check_in,
        finalCheckoutTime,
        roomPrice,
        booking.advance_paid || 0,
        JSON.stringify(normalizedAddOns),
        JSON.stringify(kitchenOrdersForBilling),
        total_amount,
        billed_by_id,
        billed_by_name,
        billed_by_role,

      ]);

      console.log("Billing record created");

      // 7) Mark kitchen orders as 'Settled'
      if (kitchenOrderRows.length > 0) {
        const kitchenIds = kitchenOrderRows.map((r) => r.ko_id);
        const placeholders = kitchenIds.map(() => "?").join(",");
        await runQuery(
          `UPDATE kitchen_orders SET status = 'Settled' WHERE id IN (${placeholders})`,
          kitchenIds
        );
        console.log(`Marked ${kitchenIds.length} kitchen orders as Settled`);
      }

      await runQuery("COMMIT");
      console.log("Transaction committed successfully");

      res.json({
        message: "Checked out successfully",
        billing_summary: {
          booking_id: booking.booking_id,
          booking_db_id: booking.id,
          room_id: booking.room_id,
          check_in: booking.check_in,
          check_out: finalCheckoutTime,
          room_price: roomPrice,
          add_ons: normalizedAddOns,
          kitchen_orders: kitchenOrdersForBilling,
          total_amount,
          billed_by: {
            name: billed_by_name,
            role: billed_by_role,
          },
          balance_amount: total_amount - (booking.advance_paid || 0),
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

// GET booking by ID (AFTER checkout route)
router.get("/:id", requireAuth, (req, res) => {
  const query = `
    SELECT 
      b.id,
      b.booking_id,
      b.check_in,
      b.check_out,
      b.status,
      b.price,
      b.advance_paid, 
      b.add_ons,
      b.created_by_id,
      b.created_by_name,
      b.created_by_role,
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

// PUT - UPDATE booking (AFTER checkout route)
router.put("/:id", requireAuth, async (req, res) => {
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

    // Update booking status
    const updateResult = await runQuery(
      "UPDATE bookings SET status = ? WHERE id = ?",
      [status, req.params.id]
    );

    // Get room id for the booking
    const row = await getQuery("SELECT room_id FROM bookings WHERE id = ?", [
      req.params.id,
    ]);
    if (!row) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Update room status
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

// DELETE booking (AFTER all other /:id routes)
router.delete("/:id", requireAuth, (req, res) => {
  db.run("DELETE FROM bookings WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Booking deleted" });
  });
});

module.exports = router;