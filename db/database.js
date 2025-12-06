const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

const dbPath = path.resolve(__dirname, process.env.DB_PATH || "hotel.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Failed to connect to DB:", err.message);
  else console.log("Connected to SQLite DB at", dbPath);
});

module.exports = db;
