const jwt = require("jsonwebtoken");
const config = require("../config");
const UnauthorizedError = require("../utils/UnauthorizedError");

// user._id ki shakal — 24 hex characters
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;

// har request ke header mein sahi JWT hona chahiye — Authorization: Bearer <token>
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  // header na ho ya "Bearer " se shuru na ho to aage nahi jaane dena
  if (!header || !header.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token missing"));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    // signature galat ho ya token expire ho chuka ho to verify throw karta hai
    // algorithms fix karo — warna token khud bata sakta hai ke kaunsa algorithm use karna hai
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });

    // jwt.verify exp ho to check karta hai, lekin exp ka HONA zaroori nahi maanta —
    // bina exp ka token hamesha chalta; hamare tokens mein exp aur sub hamesha hote hain, na hon to reject
    // sub = MongoDB ObjectId (24 hex) — kuch aur ho to aage queries mein CastError (400) ki jagah yahin 401
    if (typeof payload.exp !== "number" || typeof payload.sub !== "string" || !OBJECT_ID_PATTERN.test(payload.sub)) {
      throw new Error("Token missing exp or valid sub");
    }

    // login ke waqt sub mein user id daali thi — aage controllers isay use kar sakte hain
    req.user = { id: payload.sub };

    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}

module.exports = authMiddleware;
