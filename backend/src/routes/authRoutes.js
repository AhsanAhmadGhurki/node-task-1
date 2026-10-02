const express = require("express");
const authController = require("../controllers/authController");
const { validateAuth, validateRegister } = require("../middleware/validation");

// app.js mein root ("/") par lagaya gaya hai — isliye yahan poore paths likhe hain
const router = express.Router();

// dono mein pehle validation, pass ho to controller
// register par password ke rules (8+ characters, ek number) — login par nahi
router.post("/register", validateRegister, authController.register);
router.post("/auth/login", validateAuth, authController.login);

module.exports = router;
