const express = require("express");
const { listCrops, getCrop } = require("../controller/CCrops");

const router = express.Router();

// GET /api/v1/crops
router.get("/", listCrops);
// GET /api/v1/crops/:id
router.get("/:id", getCrop);

module.exports = router;
