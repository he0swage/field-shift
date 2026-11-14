const express = require("express");
const {
  generateRotations,
  getRotationById,
  compareRotations,
} = require("../controller/Crotation");

const router = express.Router();

// POST /rotations/generate
router.post("/generate", generateRotations);

// POST /rotations/compare
router.post("/compare", compareRotations);

// GET /rotations/:id (permet de récupérer une rotation enregistrée ou "latest")
router.get("/:id", getRotationById);

module.exports = router;
