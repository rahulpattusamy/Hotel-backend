// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const db = require("./db/database");
const cookieParser = require("cookie-parser");

require("dotenv").config();

// Import routes
const routes = require("./routes");
const billingRoutes = require("./routes/billings");
const dashboardRoutes = require("./routes/dashboard.routes");
const customerRoutes = require("./routes/customers");
const bookingsRouter = require("./routes/bookings");
const roomsRoutes = require("./routes/roomsRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const addonsRoutes = require("./routes/addons");
const expenseRoutes = require("./routes/expense");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, 
  })
);

app.use(express.json());
app.use(cookieParser());

// Initialize DB schema (run once)
const schemaPath = path.join(__dirname, "db/schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema, (err) => {
    if (err) console.error("Failed to initialize tables:", err.message);
    else console.log("Tables created/verified");
  });
}

// ---------------------------------------------
// Routes (specific first, generic last)
// ---------------------------------------------

app.use("/api/customers", customerRoutes);
app.use("/api/bookings", bookingsRouter);
app.use("/api/rooms", roomsRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/addons", addonsRoutes);
app.use("/api/billings", billingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/auth", require("./routes/auth"));

// Generic/catch-all API routes (optional)
app.use("/api", routes);

// Health check route
app.get("/", (req, res) => {
  res.send("Hotel backend API is running!");
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
