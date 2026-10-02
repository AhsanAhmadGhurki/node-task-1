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

  // apni error classes (NotFoundError waghaira) aur body-parser ke 4xx — inke messages hum ne khud likhe hain
  if (err.statusCode && err.statusCode < 500) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // anjaan error (500) — message mein kuch bhi ho sakta hai (password, DB ki andar ki baat), client ko kabhi nahi
  // log mein bhi message nahi — sirf qism aur code ki jagah (stack frames), debugging ke liye kaafi
  const frames = (err.stack || "").split("\n").slice(1, 6).join("\n");
  console.error(`Unhandled ${err.name || "Error"} on ${req.method} ${req.path}\n${frames}`);
  res.status(500).json({ message: "Internal Server Error" });
}

module.exports = errorHandler;
