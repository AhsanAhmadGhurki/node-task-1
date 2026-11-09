const express = require("express");
const authController = require("../controllers/authController");
const { validateEmail } = require("../middleware/validation");
const { registerRules, verifyEmailRules, loginRules, verifyLoginOtpRules } = require("../validators/authValidators");
const { handleValidation } = require("../middleware/validate");
const { registerLimiter, loginLimiter, resendLimiter, resendEmailCooldown, otpVerifyLimiter } = require("../middleware/rateLimit");

// app.js mein root ("/") par lagaya gaya hai — isliye yahan poore paths likhe hain
// saare auth routes /auth/* par; register, verify, resend ke purane root paths alias hain (purane clients na tootein)
// alias aur naya path ek hi route + ek hi limiter — dono raston ki ginti saath (alias se limit nahi bachti)
const router = express.Router();

// register par password ke rules (8+ characters, ek number, 72 bytes tak) — login par nahi
// register asal email bhejta hai — ek IP se ghante mein had se zyada nahi
router.post(["/auth/register", "/register"], registerLimiter, registerRules, handleValidation, authController.register);

// code guess karna — har code par 5 koshishen DB mein, aur ye IP limit alag
router.post(["/auth/verify-email", "/verify-email"], otpVerifyLimiter, verifyEmailRules, handleValidation, authController.verifyEmail);

// naya code — har request email bhejti hai: IP limit (5/15 min), phir ek email par 60s cooldown,
// aur user ki 3/ghanta ginti DB mein alag
router.post(
  ["/auth/resend-verification", "/resend-verification"],
  resendLimiter,
  validateEmail,
  resendEmailCooldown,
  authController.resendVerification
);

// purana password-only login band — 410 (404 nahi, taake purana client saaf jaane ke kya karna hai)
router.post("/auth/login", authController.loginDisabled);

// 2FA login — pehle password (code email par + loginToken), phir loginToken + code (tokens)
// login par limit — validation se pehle, taake khaali/ghalat body wali koshishen bhi ginein
// email ka spam: code sirf sahi password par, aur user ki 10/ghanta ginti DB mein (429 + retryAfter)
router.post("/auth/login/request-otp", loginLimiter, loginRules, handleValidation, authController.requestLoginOtp);
// code guess — wahi otpVerifyLimiter (verify-email ke saath ek ginti), aur har code par 5 koshishen DB mein
router.post("/auth/login/verify-otp", otpVerifyLimiter, verifyLoginOtpRules, handleValidation, authController.verifyLoginOtp);

// body nahi chahiye — refresh token httpOnly cookie se aata hai
router.post("/auth/refresh", authController.refresh);
router.post("/auth/logout", authController.logout);

module.exports = router;
