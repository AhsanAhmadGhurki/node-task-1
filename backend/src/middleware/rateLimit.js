// rate limiting — ek IP se had se zyada requests rok do (email spam aur brute force se bachao)
const { rateLimit } = require("express-rate-limit");

// limit poori ho to 429 — baaki errors jaisa { message }
function createLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    // RateLimit + Retry-After headers bhejo — client ko pata chale kitna rukna hai
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ message });
    }
  });
}

// resend sabse khatarnaak — har request asal email bhejti hai
const resendLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many verification code requests. Please try again in 15 minutes."
});

// resend — ek EMAIL par 60 second mein ek request (IP badal kar bhi nahi bachta)
// har email par lagta hai, account ho ya na ho — sirf maujood accounts par lagta to 429 batata ke account hai
// validateEmail ke BAAD lagta hai (email sahi shakal ka ho); normalize authService jaisa (trim + lowercase)
const resendEmailCooldown = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `resend:${req.body.email.trim().toLowerCase()}`,
  handler: (req, res) => {
    res.status(429).json({ message: "Please wait a minute before requesting another code." });
  }
});

// register bhi email bhejta hai — naye naye emails se spam na ho
const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many accounts created from this network. Please try again later."
});

// login — password guess karte rehna (brute force) roko, aur bcrypt (cost 12) ka CPU bhi bachao
// sirf fail koshishen (4xx/5xx) ginti mein — sahi password wala user apni limit nahi khaata
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many failed login attempts. Please try again in 15 minutes.",
  skipSuccessfulRequests: true
});

// email verify ka code (/verify-email) — har code par 5 koshishen DB mein;
// ye IP limit alag: ek IP bahut saare accounts par 5-5 guess na kar sake. sirf galat koshishen ginti mein
const otpVerifyLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many failed code attempts. Please try again in 15 minutes.",
  skipSuccessfulRequests: true
});

module.exports = {
  resendLimiter,
  resendEmailCooldown,
  registerLimiter,
  loginLimiter,
  otpVerifyLimiter
};
