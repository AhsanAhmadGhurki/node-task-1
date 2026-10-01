const express = require("express");
const authController = require("../controllers/authController");
const { validateAuth } = require("../middleware/validation");

// app.js mein "/auth" par lagaya gaya hai — isliye yahan "/register" matlab "/auth/register"
const router = express.Router();

// dono mein pehle validation, pass ho to controller
router.post("/register", validateAuth, authController.register);
router.post("/login", validateAuth, authController.login);

module.exports = router;
