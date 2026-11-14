const { validateAndLoadCrops } = require("../utils/cropStore");
const { generatePermutations, scoreRotation } = require("../utils/rotationScorer");
const { saveRotationRun, getRotationRunById, getLatestRotationRun } = require("../utils/rotationStore");
const { findRegionByCode } = require("../utils/jsonStore");

function isConsecutiveSeason(value) {
  const match = /^(\d{4})-(\d{4})$/.exec(value || "");
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}

/**
 * POST /rotations/generate (ou /api/v1/rotations/generate)
 */
function generateRotations(req, res) {
  try {
    const { regionName, cropIds, weights } = req.body || {};

    // 1. Validation du nombre de cultures (2 à 4 cultures distinctes)
    if (!Array.isArray(cropIds)) {
      return res.status(400).json({
        error: {
          code: "INVALID_CROPS_FORMAT",
          message: "cropIds doit être un tableau (Array) de 2 à 4 cultures.",
        },
      });
    }

    const uniqueCropIds = [...new Set(cropIds.map((c) => String(c).trim().toLowerCase()))];

    if (uniqueCropIds.length < 2 || uniqueCropIds.length > 4) {
      return res.status(400).json({
        error: {
          code: "INVALID_CROPS_COUNT",
          message: `La génération accepte entre 2 et 4 cultures distinctes (${uniqueCropIds.length} fournies).`,
        },
      });
    }

    // 2. Vérification de la correspondance des données dans le dossier data/
    const cropCheck = validateAndLoadCrops(uniqueCropIds);
    if (!cropCheck.valid) {
      return res.status(404).json({
        error: {
          code: "CROPS_NOT_FOUND",
          message: `Les cultures suivantes sont introuvables dans le dossier data : ${cropCheck.missing.join(", ")}`,
          availableExamples: ["ble", "orge", "lentille", "pois_chiche", "feve", "vesce", "colza", "tournesol"],
        },
      });
    }

    // 3. Génération des permutations
    const permutations = generatePermutations(cropCheck.crops);

    // 4. Calcul des notes et classement
    const evaluatedRotations = permutations.map((perm) => {
      const scoring = scoreRotation(perm, weights);
      return {
        sequence: perm.map((c) => ({
          id: c.id,
          name: c.crop || c.id,
          scientificName: c.scientific_name,
          family: c.family,
          waterNeed: c.water_need,
          droughtTolerance: c.drought_tolerance,
          nitrogenFixing: c.nitrogen_fixing === 1,
        })),
        cropNames: perm.map((c) => c.crop || c.id),
        scores: scoring.scores,
        metrics: scoring.metrics,
      };
    });

    evaluatedRotations.sort((a, b) => b.scores.weighted - a.scores.weighted);

    const rankedRotations = evaluatedRotations.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    // 5. Sauvegarde du résultat
    const resultToStore = {
      regionName: regionName || "Région non spécifiée",
      requestedCrops: uniqueCropIds,
      weights: weights || { water: 33, soil: 33, yield: 34 },
      totalPermutations: rankedRotations.length,
      bestRotation: rankedRotations[0] || null,
      rotations: rankedRotations,
    };

    const rotationId = saveRotationRun(resultToStore);

    // 6. Réponse (3 meilleures rotations)
    const limit = Number(req.query.limit) || 3;
    const topRotations = rankedRotations.slice(0, limit);

    return res.status(201).json({
      status: "success",
      rotationId,
      message: `${topRotations.length} meilleures rotations sélectionnées sur ${rankedRotations.length} permutations possibles.`,
      regionName: resultToStore.regionName,
      totalPermutations: rankedRotations.length,
      returnedCount: topRotations.length,
      weights: resultToStore.weights,
      rankedRotations: topRotations,
    });
  } catch (error) {
    console.error("Erreur lors de la génération de rotations:", error);
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Une erreur est survenue lors du calcul des rotations.",
      },
    });
  }
}

/**
 * GET /rotations/:id
 */
function getRotationById(req, res) {
  const { id } = req.params;

  let data = null;
  if (id === "latest") {
    data = getLatestRotationRun();
  } else {
    data = getRotationRunById(id);
  }

  if (!data) {
    return res.status(404).json({
      error: {
        code: "ROTATION_NOT_FOUND",
        message: `Aucun calcul de rotation trouvé avec l'identifiant '${id}'.`,
      },
    });
  }

  const limit = req.query.limit === "all" ? data.rotations.length : (Number(req.query.limit) || 3);

  return res.status(200).json({
    status: "success",
    data: {
      ...data,
      returnedCount: Math.min(limit, data.rotations.length),
      rotations: data.rotations.slice(0, limit),
    },
  });
}

/**
 * POST /rotations/compare (ou /api/v1/rotations/compare)
 * Compare la rotation habituelle avec la rotation recommandée
 */
function compareRotations(req, res) {
  try {
    const { regionCode, season, habitualCropIds, recommendedCropIds, weights } = req.body || {};

    // 1. Validation de la région
    if (!regionCode) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Le champ 'regionCode' est obligatoire.",
        },
      });
    }

    let region;
    try {
      region = findRegionByCode(regionCode);
    } catch (err) {
      return res.status(503).json({
        error: {
          code: "DATA_SOURCE_UNAVAILABLE",
          message: "La source de données régionale est actuellement indisponible.",
        },
      });
    }

    if (!region) {
      return res.status(404).json({
        error: {
          code: "REGION_NOT_FOUND",
          message: `Aucune région trouvée pour le code '${regionCode}'.`,
        },
      });
    }

    // 2. Validation de la saison
    if (!isConsecutiveSeason(season)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Le champ 'season' est requis et doit être au format YYYY-YYYY consécutif (ex: 2026-2027).",
        },
      });
    }

    // 3. Validation des listes de cultures
    if (!Array.isArray(habitualCropIds) || habitualCropIds.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "habitualCropIds doit être un tableau non vide de cultures.",
        },
      });
    }

    if (!Array.isArray(recommendedCropIds) || recommendedCropIds.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "recommendedCropIds doit être un tableau non vide de cultures.",
        },
      });
    }

    if (habitualCropIds.length !== recommendedCropIds.length) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Les deux rotations doivent avoir la même longueur (${habitualCropIds.length} vs ${recommendedCropIds.length} cultures).`,
        },
      });
    }

    // 4. Chargement des données agronomiques
    const habCheck = validateAndLoadCrops(habitualCropIds);
    if (!habCheck.valid) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Cultures habituelles introuvables : ${habCheck.missing.join(", ")}`,
        },
      });
    }

    const recCheck = validateAndLoadCrops(recommendedCropIds);
    if (!recCheck.valid) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Cultures recommandées introuvables : ${recCheck.missing.join(", ")}`,
        },
      });
    }

    // 5. Calcul des scores (Eau, Sol, Rendement, Total)
    const habScoreResult = scoreRotation(habCheck.crops, weights);
    const recScoreResult = scoreRotation(recCheck.crops, weights);

    const habitualScores = {
      water: habScoreResult.scores.water,
      soil: habScoreResult.scores.soil,
      yield: habScoreResult.scores.yield,
      total: habScoreResult.scores.weighted,
    };

    const recommendedScores = {
      water: recScoreResult.scores.water,
      soil: recScoreResult.scores.soil,
      yield: recScoreResult.scores.yield,
      total: recScoreResult.scores.weighted,
    };

    // 6. Calcul du delta (recommandée − habituelle)
    const delta = {
      water: recommendedScores.water - habitualScores.water,
      soil: recommendedScores.soil - habitualScores.soil,
      yield: recommendedScores.yield - habitualScores.yield,
      total: recommendedScores.total - habitualScores.total,
    };

    // 7. Réponse
    return res.status(200).json({
      assessment: {
        mode: "demo",
        disclaimer: "Valeurs fictives : comparaison pédagogique uniquement.",
        sources: [],
      },
      habitual: {
        cropIds: habitualCropIds,
        scores: habitualScores,
      },
      recommended: {
        cropIds: recommendedCropIds,
        scores: recommendedScores,
      },
      delta,
    });
  } catch (error) {
    console.error("Erreur lors de la comparaison des rotations:", error);
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Une erreur est survenue lors de la comparaison des rotations.",
      },
    });
  }
}

module.exports = {
  generateRotations,
  getRotationById,
  compareRotations,
};
