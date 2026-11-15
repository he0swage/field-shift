const express = require("express");
const { getMap } = require("../controller/Cmaps");

const router = express.Router();

// GET /api/v1/map
router.get("/", getMap);

module.exports = router;
