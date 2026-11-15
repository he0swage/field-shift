const { getMapSummary } = require("../utils/climateStore");

// GET /api/v1/map — one row per region (coordinates + rainfall trend) for the map view
function getMap(req, res, next) {
  try {
    return res.json(getMapSummary());
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMap };
