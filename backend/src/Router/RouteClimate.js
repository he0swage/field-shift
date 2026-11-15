const express = require("express");
const { getRegionClimate } = require("../controller/Cclimate");

const router = express.Router();

// GET /api/v1/climate?region=setif
router.get("/", getRegionClimate);

module.exports = router;
