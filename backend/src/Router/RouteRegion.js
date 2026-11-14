const express = require("express");
const {getRegions,getRegionContext} = require("../controller/Cregions");

const router = express.Router();



// GET /api/v1/regions/:regionCode/context?season=2026-2027
router.get("/:regionCode/context", getRegionContext);

module.exports = router;

