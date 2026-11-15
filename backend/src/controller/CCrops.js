const fs = require("node:fs");
const path = require("node:path");
const { getCropData } = require("../utils/cropStore");

const INDEX = path.resolve(__dirname, "../../../data/processed/crops/index.json");

// GET /api/v1/crops — the team crop table (13 crops)
function listCrops(req, res, next) {
  try {
    const { ids } = JSON.parse(fs.readFileSync(INDEX, "utf8"));
    return res.json({ count: ids.length, crops: ids.map(getCropData) });
  } catch (err) {
    return next(err);
  }
}

// GET /api/v1/crops/:id — one crop (accepts aliases like "ble", "colza", "durum")
function getCrop(req, res) {
  const crop = getCropData(req.params.id);
  if (!crop) return res.status(404).json({ error: { code: "CROP_NOT_FOUND", message: `Unknown crop '${req.params.id}'.` } });
  return res.json(crop);
}

module.exports = { listCrops, getCrop };
