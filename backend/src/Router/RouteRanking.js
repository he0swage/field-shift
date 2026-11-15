const express = require("express");
const { postRanking } = require("../controller/Cranking");

const router = express.Router();

// POST /api/v1/ranking
router.post("/", postRanking);

module.exports = router;
