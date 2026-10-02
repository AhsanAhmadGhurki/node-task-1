// rate limiting — ek IP se had se zyada requests rok do (email spam aur brute force se bachao)
const { rateLimit } = require("express-rate-limit");
const { respondPage } = require("../views/verifyPage");

// limit poori ho to 429 — browser form ko page, API client ko JSON (baaki errors jaisa { message })
function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    // RateLimit + Retry-After headers bhejo — client ko pata chale kitna rukna hai
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => {
      respondPage(res, 429, { ok: false, title: "Too many requests", message });
    }
  });
}

// resend sabse khatarnaak — har request asal email bhejti hai
// /resend-verification aur /verify/resend dono ek hi counter share karte hain
const resendLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many verification email requests. Please try again in 15 minutes."
});

// register bhi email bhejta hai — naye naye emails se spam na ho
const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many accounts created from this network. Please try again later."
});

module.exports = {
  resendLimiter,
  registerLimiter
};
