// GET /files/:fileId ke do raaste — signed link (?expires=&sig=) ya Bearer token
// <img src> header nahi bhej sakta, is liye link khud saboot hai; baaki sab (axios) token se
const authMiddleware = require("./auth");
const ForbiddenError = require("../utils/ForbiddenError");
const { verifySignedPath } = require("../utils/signedUrl");

function fileAccess(req, res, next) {
  const { expires, sig } = req.query;

  // link wale params hi nahi — aam raasta: token (na ho to 401), ownership controller mein (403)
  if (expires === undefined && sig === undefined) {
    return authMiddleware(req, res, next);
  }

  // link diya lekin ghalat, badla hua ya expire — 403 (link dikhaya, lekin ijazat nahi deta)
  // token par wapas nahi girte: link ek raasta hai, do raaste mila kar uljhan nahi
  if (!verifySignedPath(req.params.fileId, expires, sig)) {
    return next(new ForbiddenError("Invalid or expired file link"));
  }

  // link isi fileId ka aur abhi zinda — controller ownership dobara nahi dekhta (link banate waqt dekhi thi)
  req.signedFileAccess = true;
  next();
}

module.exports = fileAccess;
