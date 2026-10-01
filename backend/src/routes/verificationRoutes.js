const express = require("express");
const authController = require("../controllers/authController");
const { validateEmail } = require("../middleware/validation");

// app.js mein do jagah lagta hai — verify API key se pehle, resend baad mein
const publicRouter = express.Router();
const router = express.Router();

// email ka link browser mein khulta hai — wahan x-api-key header nahi hota, isliye public
publicRouter.get("/verify/:token", authController.verifyEmail);

// API client call karta hai — API key zaroori
router.post("/resend-verification", validateEmail, authController.resendVerification);

module.exports = {
  publicRouter,
  router
};
