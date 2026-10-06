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
    // message function bhi ho sakta hai — jaise asal bacha hua waqt (req.rateLimit.resetTime) batane ke liye
    handler: (req, res) => {
      res.status(429).json({ message: typeof message === "function" ? message(req) : message });
    }
  });
}

// window khatam hone mein kitne minute — upar round, kam se kam 1 ("0 minutes" kabhi nahi)
function minutesUntilReset(req) {
  const resetTime = req.rateLimit && req.rateLimit.resetTime;
  if (!resetTime) {
    return 15;
  }
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
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

// login (IP) — ek computer se BAHUT SAARE accounts par password aazmana (password spraying) roko, bcrypt ka CPU bhi bachao
// ek account par aazmana account lockout (authService, 5 galat → 15 min) pehle hi rokta hai — is liye yahan had 50:
// 10 thi to ek shakhs ki 10 galtiyon se poore network (office/WiFi, ek IP) ka login band, sahi password ka bhi
// sirf fail koshishen (4xx/5xx) ginti mein — sahi password wala user apni limit nahi khaata
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  // "from this network" — account lockout (423, "Account locked…") se alag pehchana jaye
  message: (req) => {
    const minutes = minutesUntilReset(req);
    return `Too many failed login attempts from this network. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  },
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
