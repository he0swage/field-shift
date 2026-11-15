const { getClimate } = require("../utils/climateStore");

// GET /api/v1/climate?region=setif
function getRegionClimate(req, res, next) {
  const region = String(req.query.region || "").trim();
  if (!region) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Query parameter 'region' is required (e.g. ?region=setif)." } });
  }
  try {
    const climate = getClimate(region);
    if (!climate) {
      return res.status(404).json({ error: { code: "REGION_NOT_FOUND", message: `No processed climate data for '${region}' yet.` } });
    }
    return res.json(climate);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getRegionClimate };
