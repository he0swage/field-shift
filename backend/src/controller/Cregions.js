const {
  findRegionByCode,
  listRegions,
} = require("../utils/jsonStore");

function isConsecutiveSeason(value) {
  const match = /^(\d{4})-(\d{4})$/.exec(value || "");
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}


function getRegionContext(req, res, next) {
  const { regionCode } = req.params;
  const { season } = req.query;

  if (!isConsecutiveSeason(season)) {
    return res.status(400).json({
      error: {
        code: "INVALID_SEASON",
        message: "season is required and must use the format YYYY-YYYY, for example 2026-2027.",
      },
    });
  }

  try {
    const region = findRegionByCode(regionCode);
     if (!region) {
      return res.status(404).json({
        error: {
          code: "REGION_NOT_FOUND",
          message: `No regional context was found for '${regionCode}'.`,
        },
      });
    }

    const indicators = {
      waterStressPercent: Math.round(region.water_stress * 100),
      organicCarbon: {
        valueGPerKg: region.soil_organic_carbon_g_per_kg,
        classification: region.organic_carbon.class,
        sourceLabel: "SoilGrids live",
      },
      frostRiskPercent: Math.round(region.frost_risk * 100),
      erosionRiskPercent: Math.round(region.erosion_risk * 100),
    };
     // Return only the four summary indicators used by the React region panel.
    // The supplied measurements are a 1995-2024 baseline, not season-specific.
    return res.json({
      region: {
        code: region.code,
        label: region.label,
      },
      season,
      indicators,
      display: {
        water: ` Water stress: ${indicators.waterStressPercent}%`,
        organicCarbon: ` SOC: ${indicators.organicCarbon.valueGPerKg.toFixed(2)} g/kg (${indicators.organicCarbon.classification.replace(/\)$/, "")} · ${indicators.organicCarbon.sourceLabel}))`,
        frostRisk: ` Frost risk: ${indicators.frostRiskPercent}%`,
        erosionRisk: ` Erosion risk: ${indicators.erosionRiskPercent}%`,
      },
      metadata: {
        seasonSpecific: false,
        climateBaselinePeriod: "1995-2024",
        demoOnly: true,
      },
    });
     } catch (error) {
    return next(error);
  }
}

module.exports = { getRegionContext };