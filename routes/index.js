const express = require("express");
const router = express.Router();
const roomsRoutes = require("./roomsRoutes");

router.use("/rooms", roomsRoutes);

module.exports = router;
