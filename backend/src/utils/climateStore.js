// Reads the team's processed climate data (data/regional + data/processed/<region>/).
const fs = require("node:fs");
const path = require("node:path");
const { findRegionByCode } = require("./jsonStore");

const PROCESSED = path.resolve(__dirname, "../../../data/processed");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Climate payload in the shape the frontend expects:
 * { source, sample:false, annual:[{year,rain}], monthly:[12], indicators:{...}, text:{...} }
 * Returns null when the region has no processed data.
 */
function getClimate(regionCode) {
  const region = findRegionByCode(regionCode);
  if (!region || region.isDemo) return null;

  const dir = path.join(PROCESSED, region.code);
  if (!fs.existsSync(dir)) return null;

  const yearly = readJson(path.join(dir, "climate_yearly.json"));
  const monthly = readJson(path.join(dir, "climate_monthly.json"));
  const textFile = path.join(dir, "climate_text.json");
  const text = fs.existsSync(textFile) ? readJson(textFile) : {};
  const base = region.climate_baseline || {};

  return {
    region: region.code,
    label: region.label,
    source: region.sources?.climate || "NASA POWER 1995-2024",
    sample: false,
    annual: yearly.rows
      .filter((r) => r.annual_rain_mm != null)
      .map((r) => ({ year: r.year, rain: r.annual_rain_mm })),
    monthly: monthly.monthly_rain_mm,
    indicators: {
      hotDays: Math.round(base.hot_days),
      frostDays: Math.round(base.frost_days),
      extremeRainDays: Math.round(base.extreme_rain_days),
      longestDrySpell: Math.round(base.longest_dry_spell_days),
    },
    trend: {
      mmPerDecade: base.rainfall_trend_decade_mm,
      label: region.confidence?.indicators,
      olsP: region.confidence?.ols_p,
      mkP: region.confidence?.mk_p,
    },
    soil: {
      ph: region.ph,
      organicCarbonGPerKg: region.soil_organic_carbon_g_per_kg,
      organicCarbonClass: region.organic_carbon?.class,
    },
    text: Object.fromEntries(Object.entries(text).map(([k, v]) => [k, v.en])),
  };
}

function getMapSummary() {
  return readJson(path.join(PROCESSED, "regions_summary.json"));
}

module.exports = { getClimate, getMapSummary };
