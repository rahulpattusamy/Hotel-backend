const express = require("express");
const router = express.Router();
const roomsController = require("../controllers/roomsController");
router.get("/active", roomsController.getActiveRooms);

router.get("/", roomsController.getAllRooms);
router.get("/:id", roomsController.getRoomById);
router.post("/", roomsController.createRoom);
router.put("/:id", roomsController.updateRoom);
router.delete("/:id", roomsController.deleteRoom);
// GET active rooms with guest info

module.exports = router;
