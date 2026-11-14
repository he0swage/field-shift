const fs = require("node:fs");
const path = require("node:path");

const CROPS_DIR = path.resolve(__dirname, "../../../data/processed/crops");

// Dictionnaire d'alias pour mapper les noms français/variantes vers les IDs réels dans data/processed/crops/
const CROP_ALIASES = {
  // Blé
  ble: "wheat",
  blé: "wheat",
  wheat: "wheat",
  ble_dur: "wheat",
  durum: "wheat",
  ble_tendre: "soft_wheat",
  soft_wheat: "soft_wheat",

  // Orge
  orge: "barley",
  barley: "barley",

  // Lentille
  lentille: "lentil",
  lentil: "lentil",

  // Pois chiche
  pois_chiche: "chickpea",
  chickpea: "chickpea",

  // Fève
  feve: "faba",
  fève: "faba",
  faba: "faba",

  // Vesce
  vesce: "vetch",
  vetch: "vetch",

  // Colza / Rapeseed
  colza: "canola",
  canola: "canola",
  rapeseed: "canola",

  // Avoine
  avoine: "oats",
  oats: "oats",

  // Tournesol
  tournesol: "sunflower",
  sunflower: "sunflower",

  // Carthame
  carthame: "safflower",
  safflower: "safflower",

  // Triticale
  triticale: "triticale",

  // Jachère
  fallow: "fallow",
  jachere: "fallow",
};

/**
 * Charge les données d'une culture depuis data/processed/crops/{id}.json
 * @param {string} rawCropId - ID ou nom fourni (ex: "ble", "lentille", "wheat")
 * @returns {object|null} Données agronomiques de la culture ou null si non trouvée
 */
function getCropData(rawCropId) {
  if (!rawCropId) return null;
  const normalized = String(rawCropId).trim().toLowerCase();
  const fileId = CROP_ALIASES[normalized] || normalized;
  const filePath = path.join(CROPS_DIR, `${fileId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

/**
 * Valide et charge une liste de cultures depuis le dossier data
 * @param {string[]} cropIds - Tableau d'identifiants
 * @returns {{ valid: boolean, crops: object[], missing: string[] }}
 */
function validateAndLoadCrops(cropIds) {
  const crops = [];
  const missing = [];

  for (const id of cropIds) {
    const data = getCropData(id);
    if (!data) {
      missing.push(id);
    } else {
      crops.push(data);
    }
  }

  return {
    valid: missing.length === 0,
    crops,
    missing,
  };
}

module.exports = {
  CROP_ALIASES,
  getCropData,
  validateAndLoadCrops,
};
