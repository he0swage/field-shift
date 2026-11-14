/**
 * Génère toutes les permutations possibles d'un tableau d'éléments (Algorithme récursif de Heap / Backtracking)
 * Pour n cultures distinctes, génère exactement n! permutations.
 * Exemples :
 * - 2 cultures -> 2! = 2
 * - 3 cultures -> 3! = 6
 * - 4 cultures -> 4! = 24
 *
 * @param {Array} arr - Tableau d'éléments
 * @returns {Array<Array>} Tableau de toutes les permutations
 */
function generatePermutations(arr) {
  if (arr.length <= 1) return [arr];
  const results = [];

  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const subPermutations = generatePermutations(remaining);
    for (const sub of subPermutations) {
      results.push([current, ...sub]);
    }
  }

  return results;
}

/**
 * Calcule les scores agronomiques pour une séquence ordonnée de cultures dans la rotation
 * @param {object[]} rotationCrops - Liste ordonnée des objets cultures (avec métadonnées de data/)
 * @param {{ water: number, soil: number, yield: number }} weights - Poids des 3 critères
 * @returns {object} Scores détaillés et note pondérée
 */
function scoreRotation(rotationCrops, weights) {
  const n = rotationCrops.length;

  // -------------------------------------------------------------
  // 1. NOTE EAU (Water Score) : Résilience hydrique & sécheresse
  // -------------------------------------------------------------
  // Plus le water_need est faible et le drought_tolerance élevé, meilleure est la note.
  let totalWaterNeed = 0;
  let totalDroughtTol = 0;

  for (const crop of rotationCrops) {
    totalWaterNeed += crop.water_need ?? 0.45;
    totalDroughtTol += crop.drought_tolerance ?? 0.65;
  }

  const avgWaterNeed = totalWaterNeed / n;
  const avgDroughtTol = totalDroughtTol / n;

  // Base score eau : 100 - (besoin en eau normalisé sur 100) + bonus tolérance sécheresse
  let rawWaterScore = (1 - avgWaterNeed) * 60 + avgDroughtTol * 40;

  // Pénalité si 2 cultures gourmandes en eau (water_need > 0.5) se suivent
  for (let i = 0; i < n - 1; i++) {
    if ((rotationCrops[i].water_need ?? 0) > 0.5 && (rotationCrops[i + 1].water_need ?? 0) > 0.5) {
      rawWaterScore -= 10;
    }
  }

  const waterScore = Math.max(10, Math.min(100, Math.round(rawWaterScore)));

  // -------------------------------------------------------------
  // 2. NOTE SOL (Soil Score) : Matière organique & Azote (N)
  // -------------------------------------------------------------
  // Critères clés : Légumineuses fixatrices d'azote, diversification des familles botaniques
  let rawSoilScore = 60; // base moyenne
  let totalNImpact = 0;

  for (let i = 0; i < n; i++) {
    const c = rotationCrops[i];
    totalNImpact += c.n_impact_kg_ha ?? 0;

    // Fixation biologique d'azote
    if (c.nitrogen_fixing === 1 || c.family === "legume") {
      rawSoilScore += 12;
    }

    // Effet sur la santé du sol
    if (c.soil_health_delta) {
      rawSoilScore += c.soil_health_delta * 0.4;
    }
  }

  // Règles de succession agronomique (Ordre des années) :
  for (let i = 0; i < n - 1; i++) {
    const curr = rotationCrops[i];
    const next = rotationCrops[i + 1];

    // Pénalité monoculture / même famille botanique d'affilée (ex: blé après orge)
    if (curr.family && curr.family === next.family) {
      rawSoilScore -= 18; // Pénalité fatigue des sols & maladies racinaires
    }

    // Bonus idéal : Une légumineuse qui précède une céréale (effet précédent favorable)
    if (curr.family === "legume" && next.family === "cereal") {
      rawSoilScore += 15;
    }
  }

  const soilScore = Math.max(10, Math.min(100, Math.round(rawSoilScore)));

  // -------------------------------------------------------------
  // 3. NOTE RENDEMENT / REVENU (Yield Score) : Stabilité & Rentabilité
  // -------------------------------------------------------------
  let totalProfit = 0;
  let totalRisk = 0;

  for (const crop of rotationCrops) {
    totalProfit += crop.profit ?? 0.6;
    totalRisk += crop.risk_level ?? 0.35;
  }

  const avgProfit = totalProfit / n;
  const avgRisk = totalRisk / n;

  let rawYieldScore = avgProfit * 70 + (1 - avgRisk) * 30;

  // Bonus si diversification complète (toutes familles distinctes)
  const families = new Set(rotationCrops.map((c) => c.family));
  if (families.size === n) {
    rawYieldScore += 10; // Rupture des cycles de maladies/ravageurs
  }

  const yieldScore = Math.max(10, Math.min(100, Math.round(rawYieldScore)));

  // -------------------------------------------------------------
  // 4. NOTE PONDÉRÉE (Weighted Final Score)
  // -------------------------------------------------------------
  const wWater = Number(weights?.water ?? 33.33);
  const wSoil = Number(weights?.soil ?? 33.33);
  const wYield = Number(weights?.yield ?? 33.33);
  const totalWeight = wWater + wSoil + wYield || 100;

  const weightedScore = Math.round(
    (waterScore * wWater + soilScore * wSoil + yieldScore * wYield) / totalWeight
  );

  return {
    scores: {
      water: waterScore,
      soil: soilScore,
      yield: yieldScore,
      weighted: weightedScore,
    },
    metrics: {
      averageWaterNeed: Number(avgWaterNeed.toFixed(2)),
      totalNitrogenImpactKg: totalNImpact,
      distinctFamilies: families.size,
    },
  };
}

module.exports = {
  generatePermutations,
  scoreRotation,
};
