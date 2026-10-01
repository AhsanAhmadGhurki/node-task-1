const mongoose = require("mongoose");

// centralized error handler — 4 parameters (err pehle) se Express isay error handler maanta hai
// kisi bhi route mein throw hua error seedha yahan aata hai
function errorHandler(err, req, res, next) {
  // galat id (jaise /tasks/abc) ya galat type (completed: "haan") — client ki galti, 400
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }

  // schema ka rule toota (jaise title khali) — 400
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error"
  });
}

module.exports = errorHandler;
