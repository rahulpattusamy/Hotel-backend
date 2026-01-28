const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const db = require("./db/database");

require("dotenv").config();

// ================= ROUTES =================
const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff.routes");
const billingRoutes = require("./routes/billings");
const dashboardRoutes = require("./routes/dashboard.routes");
const customerRoutes = require("./routes/customers");
const bookingsRoutes = require("./routes/bookings");
const roomsRoutes = require("./routes/roomsRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const addonsRoutes = require("./routes/addons");
const expenseRoutes = require("./routes/expense");
const gstRoutes = require("./routes/gst.routes");

// ================= APP =================
const app = express();
const PORT = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= DATABASE INIT =================
const schemaPath = path.join(__dirname, "db/schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema, (err) => {
    if (err) {
      console.error("Failed to initialize DB:", err.message);
    } else {
      console.log("Tables created / verified");
    }
  });
}

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/addons", addonsRoutes);
app.use("/api/billings", billingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/gst", gstRoutes);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("Hotel backend API is running!");
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
