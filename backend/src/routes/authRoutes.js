const express = require("express");
const authController = require("../controllers/authController");
const { validateAuth, validateRegister } = require("../middleware/validation");
const { registerLimiter, loginLimiter } = require("../middleware/rateLimit");

// app.js mein root ("/") par lagaya gaya hai — isliye yahan poore paths likhe hain
const router = express.Router();

// dono mein pehle validation, pass ho to controller
// register par password ke rules (8+ characters, ek number) — login par nahi
// register asal email bhejta hai — ek IP se ghante mein had se zyada accounts nahi
router.post("/register", registerLimiter, validateRegister, authController.register);
// login par limit — validation se pehle, taake khaali/ghalat body wali koshishen bhi ginein
router.post("/auth/login", loginLimiter, validateAuth, authController.login);

// body nahi chahiye — refresh token httpOnly cookie se aata hai
router.post("/auth/refresh", authController.refresh);
router.post("/auth/logout", authController.logout);

module.exports = router;
