const express = require("express");
const authController = require("../controllers/authController");
const { validateEmail } = require("../middleware/validation");
const { resendLimiter } = require("../middleware/rateLimit");

// app.js mein do jagah lagta hai — publicRouter API key se pehle, router baad mein
const publicRouter = express.Router();
const router = express.Router();

// email ka link browser mein khulta hai — wahan x-api-key header nahi hota, isliye public
publicRouter.get("/verify/:token", authController.verifyEmail);

// verification page ka "Resend" form — browser se aata hai (API key nahi), body HTML form (urlencoded) mein
// public hai isliye rate limit sabse pehle
publicRouter.post(
  "/verify/resend",
  resendLimiter,
  express.urlencoded({ extended: false }),
  validateEmail,
  authController.resendVerification
);

// API client call karta hai — API key zaroori
router.post("/resend-verification", resendLimiter, validateEmail, authController.resendVerification);

module.exports = {
  publicRouter,
  router
};
