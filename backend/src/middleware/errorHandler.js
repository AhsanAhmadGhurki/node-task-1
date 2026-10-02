const mongoose = require("mongoose");

// centralized error handler — 4 parameters (err pehle) se Express isay error handler maanta hai
// kisi bhi route mein throw hua error seedha yahan aata hai
function errorHandler(err, req, res, next) {
  // kharab JSON body — Node ka parse error body ka hissa message mein daal deta hai
  // (jaise "[MyPassword1]" is not valid JSON) — isliye message kabhi client ko nahi bhejte, password leak ho jata
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }

  // galat id (jaise /tasks/abc) ya galat type (completed: "haan") — client ki galti, 400
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }

  // schema ka rule toota (jaise title khali) — 400
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: err.message });
  }

  // unique index toota (do requests ne ek saath same email register kiya) — 409
  if (err.code === 11000) {
    return res.status(409).json({ message: "Email already registered" });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error"
  });
}

module.exports = errorHandler;
