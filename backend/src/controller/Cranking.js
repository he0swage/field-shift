const { rank } = require("../utils/rankingEngine");

// POST /api/v1/ranking
// body: { region, rotation[3], allowed[], priorities{water,soil,yield}, scenario{rain,temp}, custom[] }
function postRanking(req, res, next) {
  const body = req.body || {};
  if (!Array.isArray(body.allowed) || !Array.isArray(body.rotation) || body.rotation.length !== 3) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "'allowed' must be an array and 'rotation' an array of 3 crop ids." },
    });
  }
  const p = body.priorities || {};
  const sum = (p.water || 0) + (p.soil || 0) + (p.yield || 0);
  if (sum !== 100) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: `Priorities must total 100 (got ${sum}).` } });
  }
  try {
    return res.json(rank(body));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.details } });
    return next(err);
  }
}

module.exports = { postRanking };
