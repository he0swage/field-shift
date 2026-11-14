const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Dossier pour sauvegarder les résultats si on veut une persistance fichier
const STORAGE_DIR = path.resolve(__dirname, "../../../data/processed/rotations");

// Stockage en mémoire (RAM) : Ultra rapide, idéal pour hackathon / démo
const inMemoryStore = new Map();
let latestId = null;

// S'assurer que le dossier existe sur disque
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * Sauvegarde le résultat d'une génération de rotation
 * @param {object} payload - Données à stocker
 * @returns {string} L'ID unique généré pour ce résultat
 */
function saveRotationRun(payload) {
  // Générer un identifiant unique (ex: rot_7f83b2a1)
  const id = "rot_" + crypto.randomUUID().slice(0, 8);
  const record = {
    id,
    createdAt: new Date().toISOString(),
    ...payload,
  };

  // 1. Sauvegarde en Mémoire (RAM)
  inMemoryStore.set(id, record);
  latestId = id;

  // 2. Sauvegarde sur Disque (Fichier JSON persistant)
  try {
    const filePath = path.join(STORAGE_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
  } catch (err) {
    console.error("Erreur lors de l'écriture sur disque:", err);
  }

  return id;
}

/**
 * Récupère une rotation enregistrée par son ID
 * @param {string} id - L'identifiant (ex: rot_7f83b2a1)
 * @returns {object|null}
 */
function getRotationRunById(id) {
  // Vérifier d'abord dans la RAM
  if (inMemoryStore.has(id)) {
    return inMemoryStore.get(id);
  }

  // Sinon vérifier sur le disque
  const filePath = path.join(STORAGE_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      inMemoryStore.set(id, data); // remettre en cache
      return data;
    } catch (err) {
      console.error("Erreur lecture fichier rotation:", err);
    }
  }

  return null;
}

/**
 * Récupère la dernière rotation générée
 */
function getLatestRotationRun() {
  if (latestId && inMemoryStore.has(latestId)) {
    return inMemoryStore.get(latestId);
  }
  return null;
}

module.exports = {
  saveRotationRun,
  getRotationRunById,
  getLatestRotationRun,
};
