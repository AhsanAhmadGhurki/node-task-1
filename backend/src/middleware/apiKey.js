const crypto = require("crypto");
const config = require("../config");

// timingSafeEqual sirf barabar lambai ke buffers leta hai — dono ka SHA-256 (hamesha 32 bytes) compare karo
// !== pehle galat character par ruk jaata hai; is waqt ke farq se key ek ek character andaza lagayi ja sakti hai
// pehli request par banta hai, file load par nahi — index.js app ko validateEnv se pehle require karta hai,
// aur API_KEY na ho to yahan crash ki jagah validateEnv ka saaf message aana chahiye
let expectedKeyHash;

function isValidApiKey(apiKey) {
  expectedKeyHash ??= crypto.createHash("sha256").update(config.apiKey).digest();
  const givenKeyHash = crypto.createHash("sha256").update(apiKey).digest();
  return crypto.timingSafeEqual(givenKeyHash, expectedKeyHash);
}

// har request ke header mein sahi x-api-key honi chahiye
function apiKeyMiddleware(req, res, next) {
  // header ke naam hamesha chhote huroof mein aate hain
  const apiKey = req.headers["x-api-key"];

  // key na ho ya galat ho to 401 bhej kar yahin ruk jao
  // string na ho (do baar header bhejne par array aata hai) to bhi 401
  if (typeof apiKey !== "string" || !isValidApiKey(apiKey)) {
    return res.status(401).json({ message: "Invalid or missing API key" });
  }

  // key sahi hai — route tak jaane do
  next();
}

module.exports = apiKeyMiddleware;
