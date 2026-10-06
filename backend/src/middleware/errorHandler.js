const mongoose = require("mongoose");
const multer = require("multer");

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
  // err.message nahi bhejte — Mongoose usmein value daal deta hai ("Cast to string failed for value "<password>"")
  // har field ka sirf naam: required ka apna message (value nahi hoti), baaki sab "Invalid <field>"
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((fieldError) => (fieldError.kind === "required" ? fieldError.message : `Invalid ${fieldError.path}`))
      .join(", ");
    return res.status(400).json({ message });
  }

  // unique index toota (do requests ne ek saath same email register kiya) — 409
  // MongoDB ka message ("dup key: { email: ... }") nahi bhejte — apna fixed message
  if (err.code === 11000) {
    return res.status(409).json({ message: "Email already registered" });
  }

  // Multer (avatar upload) ki galtiyan — client ki galti, lekin MulterError par statusCode nahi hota,
  // is liye yahan na pakdo to neeche generic 500 ban jaata
  if (err instanceof multer.MulterError) {
    // upload.js ki 2 MB had se badi file
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Avatar file is too large. Maximum size is 2 MB." });
    }

    // upload.single("avatar") — file kisi aur naam ("photo", "image"…) se aayi; chupke se ignore nahi, reject
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: 'Only the "avatar" file field is allowed.' });
    }

    // baaki (jaise ek se zyada file — LIMIT_FILE_COUNT) — err.message nahi, apna fixed message
    return res.status(400).json({ message: "Invalid file upload." });
  }

  // apni error classes (NotFoundError waghaira) aur body-parser ke 4xx — inke messages hum ne khud likhe hain
  if (err.statusCode && err.statusCode < 500) {
    // lock/limit wale errors — client ko pata chale kitni der baad dobara koshish kare
    if (err.retryAfterSeconds) {
      res.set("Retry-After", String(err.retryAfterSeconds));
    }
    return res.status(err.statusCode).json({ message: err.message });
  }

  // anjaan error (500) — message mein kuch bhi ho sakta hai (password, DB ki andar ki baat), client ko kabhi nahi
  // log mein bhi message nahi — sirf qism aur code ki jagah (stack frames), debugging ke liye kaafi
  const frames = (err.stack || "").split("\n").slice(1, 6).join("\n");
  console.error(`Unhandled ${err.name || "Error"} on ${req.method} ${req.path}\n${frames}`);
  res.status(500).json({ message: "Internal Server Error" });
}

module.exports = errorHandler;
