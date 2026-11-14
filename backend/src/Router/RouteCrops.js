const express = require("express");
const app = express();
const router = express.Router();
const {getCropsregion} = require("../controller/CCrops");


router.get("/Crops/:Country", getCropsregion);

module.export = router;