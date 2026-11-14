const fs = require("node:fs");
const path = require("node:path");

const dataPath = path.resolve(__dirname, "../../../data/regional/all_indicators.json");

function readRegionsFile() {
  const fileContents = fs.readFileSync(dataPath, "utf8");
  return JSON.parse(fileContents);
}

function listRegions() {
  return Object.values(readRegionsFile());
}

function findRegionByCode(regionCode) {
  if (!regionCode) return null;
  const normalizedCode = String(regionCode).trim().toLowerCase();

  // Support région démo demandée dans le sujet (ex: FR-OCC)
  if (normalizedCode === "fr-occ" || normalizedCode.includes("occitanie") || normalizedCode.includes("demo")) {
    return {
      code: regionCode,
      label: "Occitanie — démo",
      region: "FR-OCC",
      isDemo: true,
    };
  }

  return listRegions().find((region) =>
    region.code.toLowerCase() === normalizedCode ||
    region.region.toLowerCase() === normalizedCode
  );
}

module.exports = { findRegionByCode, listRegions };
