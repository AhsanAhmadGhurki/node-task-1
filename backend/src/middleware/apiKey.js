const config = require("../config");

// har request ke header mein sahi x-api-key honi chahiye
function apiKeyMiddleware(req, res, next) {
  // header ke naam hamesha chhote huroof mein aate hain
  const apiKey = req.headers["x-api-key"];

  // key na ho ya galat ho to 401 bhej kar yahin ruk jao
  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({ message: "Invalid or missing API key" });
  }

  // key sahi hai — route tak jaane do
  next();
}

module.exports = apiKeyMiddleware;
