const express = require("express");
const { postLogin, getMe, postLogout } = require("../controller/Cauth");

const router = express.Router();

router.post("/login", postLogin);
router.get("/me", getMe);
router.post("/logout", postLogout);

module.exports = router;
