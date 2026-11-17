const jwt = require("jsonwebtoken");
const config = require("../config");
const UnauthorizedError = require("../utils/UnauthorizedError");
const authService = require("../services/authService");

// user._id ki shakal — 24 hex characters
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;

// har request ke header mein sahi JWT hona chahiye — Authorization: Bearer <token>
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  // header na ho ya "Bearer " se shuru na ho to aage nahi jaane dena
  if (!header || !header.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token missing"));
  }

  const token = header.slice("Bearer ".length).trim();

  let userId;
  let issuedAt;
  try {
    // signature galat ho ya token expire ho chuka ho to verify throw karta hai
    // algorithms fix karo — warna token khud bata sakta hai ke kaunsa algorithm use karna hai
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });

    // jwt.verify exp ho to check karta hai, lekin exp ka HONA zaroori nahi maanta —
    // bina exp ka token hamesha chalta; hamare tokens mein exp aur sub hamesha hote hain, na hon to reject
    // sub = MongoDB ObjectId (24 hex) — kuch aur ho to aage queries mein CastError (400) ki jagah yahin 401
    // iat bhi — password badalne se pehle bane tokens pehchanne ke liye (hamare tokens mein hamesha hota hai)
    if (
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      typeof payload.sub !== "string" ||
      !OBJECT_ID_PATTERN.test(payload.sub)
    ) {
      throw new Error("Token missing exp, iat or valid sub");
    }

    userId = payload.sub;
    issuedAt = payload.iat;
  } catch {
    return next(new UnauthorizedError("Invalid or expired token"));
  }

  try {
    // token sahi, lekin user delete ho chuka, ya password is token ke baad badla — wahi 401
    // (frontend refresh karega; password badla ho to refresh tokens bhi mit chuke, phir logout)
    // DB service ke zariye — middleware Mongoose ko seedha nahi chhoota
    if (!(await authService.userExists(userId, issuedAt))) {
      return next(new UnauthorizedError("Invalid or expired token"));
    }
  } catch (err) {
    // DB down jaisi galti — 401 nahi, asal error (500) central handler ko
    return next(err);
  }

  // login ke waqt sub mein user id daali thi — aage controllers isay use kar sakte hain
  req.user = { id: userId };

  next();
}

module.exports = authMiddleware;
