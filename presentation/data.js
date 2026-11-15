// data.js : toutes les valeurs affichees dans la presentation.
// IMPORTANT : ce sont des VALEURS D'EXEMPLE (celles de la maquette). Remplacez-les par les
// chiffres confirmes par Achref avant de presenter aux juges.
const DATA = {
  region: {
    name: "Region A · Sétif",
    area: "High Plains, northern Algeria",
    rainfallChangePct: -15,          // evolution de la pluie sur 20 ans (%)
    years: [2006, 2026],
    // pluie annuelle en mm, une valeur par annee de 2006 a 2026
    rainfall: [432, 418, 441, 405, 426, 398, 415, 389, 402, 410, 381, 395, 372, 388, 399, 364, 379, 358, 371, 362, 367],
    hotDays: [12, 25],               // jours tres chauds par an : 2006 -> 2026
    soil: { clay: 35, sand: 40, silt: 25, carbon: "Low", ph: 7.8 },
  },
  priorities: { water: 50, soil: 30, yield: 20 },   // curseurs du fermier (total 100)
  phone: {
    crops: [
      { name: "Wheat", water: 80, note: "High water need" },
      { name: "Barley", water: 55, note: "Medium water need" },
      { name: "Lentil", water: 30, note: "Low water need · adds nitrogen" },
    ],
    best: { rotation: ["Wheat", "Lentil", "Barley"], score: 78, water: 90, soil: 70, yield: 60 },
  },
  // classement affiche sur le PC (slide 4)
  ranking: [
    { rotation: ["Wheat", "Lentil", "Barley"], score: 78 },
    { rotation: ["Barley", "Lentil", "Wheat"], score: 71 },
    { rotation: ["Wheat", "Fallow", "Barley"], score: 64 },
  ],
  compare: {
    usual: { rotation: ["Wheat", "Wheat", "Wheat"], water: 55, soil: 40, yield: 65 },
    rank1: { rotation: ["Wheat", "Lentil", "Barley"], water: 90, soil: 70, yield: 60 },
  },
};

// Geometrie de la carte (generee) : frontieres et villes, en coordonnees de la scene 1600 x 900.
const MAP = {
  earthTarget: [0.4856, 0.4147],
  places: { "Setif": [998, 350], "Tiaret": [524, 469], "Algiers": [726, 268] },
  borders: {
    Tunisia: "M1705,786 L1700,828 L1708,882 L1688,908 L1626,946 L1601,968 L1585,996 L1553,1018 L1550,1067 L1560,1123 L1537,1164 L1508,1199 L1468,1181 L1448,1085 L1426,980 L1396,927 L1337,879 L1312,805 L1271,779 L1255,733 L1240,671 L1270,631 L1304,593 L1327,561 L1335,510 L1335,464 L1331,418 L1331,370 L1337,317 L1322,302 L1350,267 L1368,249 L1421,210 L1502,184 L1505,202 L1517,201 L1541,196 L1569,252 L1590,262 L1641,224 L1661,251 L1623,306 L1587,340 L1599,394 L1647,431 L1651,474 L1631,539 L1554,618 L1535,647 L1566,707 L1612,724 L1635,736 L1664,759 L1674,774 L1686,783 L1705,786",
    Morocco: "M114,507 L148,546 L158,573 L169,596 L163,614 L172,688 L182,731 L191,802 L214,856 L242,878 L227,909 L229,942 L181,944 L112,940 L55,944 L31,952 L21,982 L-58,1002 L-75,1013 L-69,1040 L-72,1066 L-66,1080 L-49,1094 L-58,1111 L-110,1131 L-165,1161 L-216,1201 L-261,1255 L-325,1273 L-366,1276 L-383,1276 L-385,1298 L-398,1311 L-452,1303 L-468,1310 L-497,1336 L-550,1368 L-654,824 L-591,759 L-429,672 L-320,424 L-281,402 L-241,392 L-238,433 L-166,493 L-68,487 L-22,492 L26,464 L32,481 L54,503 L114,507 L114,507",
    Algeria: "M1366,241 L1357,263 L1325,298 L1334,311 L1334,350 L1327,406 L1337,438 L1344,493 L1328,548 L1313,586 L1280,608 L1242,656 L1244,709 L1267,774 L1307,800 L1334,857 L1378,913 L1420,948 L1441,1049 L1462,1152 L1463,1222 L1478,1278 L1501,1340 L1512,1398 L-550,1368 L-497,1336 L-468,1310 L-452,1303 L-398,1311 L-385,1298 L-383,1276 L-366,1276 L-325,1273 L-261,1255 L-216,1201 L-165,1161 L-110,1131 L-58,1111 L-49,1094 L-66,1080 L-72,1066 L-69,1040 L-75,1013 L-58,1002 L21,982 L31,952 L55,944 L112,940 L181,944 L229,942 L227,909 L242,878 L214,856 L191,802 L182,731 L172,688 L163,614 L169,596 L158,573 L148,546 L114,507 L177,496 L231,451 L322,398 L365,402 L407,354 L484,313 L642,289 L716,264 L923,247 L974,279 L1035,261 L1105,226 L1174,244 L1206,219 L1274,250 L1366,241 L1366,241",
  },
};