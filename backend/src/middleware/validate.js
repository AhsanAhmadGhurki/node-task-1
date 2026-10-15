// express-validator ke rules chalne ke baad — saari galtiyan ek saath, ek hi shape mein
const { validationResult } = require("express-validator");
const BadRequestError = require("../utils/BadRequestError");

// rules khud request nahi rokte, sirf galtiyan req par note karte hain — yahan sab ikatthi ho kar 400 banti hain
// res.status(400) nahi, next(error) — tickets route ka discardTicketUploads (error middleware) tabhi chalta hai
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  // poori body ka rule (jaise profile ki anjaan fields) ka path "" hota hai — use "body" kehte hain
  // onlyFirstError: har field ki sirf pehli galti — warna ek ghalat email ki 3 galtiyan ek saath
  const errors = result.array({ onlyFirstError: true }).map((error) => ({ field: error.path || "body", message: error.msg }));

  // message = pehli galti — frontend (toAlert) aur purane clients abhi bhi sirf message padhte hain
  const error = new BadRequestError(errors[0].message);
  error.errors = errors;
  next(error);
}

module.exports = { handleValidation };
