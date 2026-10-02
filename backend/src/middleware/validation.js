// request validation — controller tak pahunchne se pehle body check karo
const { respondPage } = require("../views/verifyPage");

// simple email shakal: kuch@kuch.kuch — spaces nahi, ek @, aur @ ke baad domain mein dot
// poori RFC wali validation nahi — asal saboot verification email hi hai
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// email ka missing / galat format — dono jagah (register, resend) ek hi rule
// error message lautata hai, sab theek ho to null
function emailError(email) {
  if (typeof email !== "string" || email.trim() === "") {
    return "Email is required";
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return "Please enter a valid email address";
  }

  return null;
}

// POST /tasks — title zaroori hai
function validateCreateTask(req, res, next) {
  // body na bheji ho to Express 5 mein req.body undefined hota hai — isliye || {}
  const { title } = req.body || {};

  // title na ho, string na ho, ya sirf spaces ho to 400 — next() nahi chalega, controller tak nahi jayega
  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ message: "Title is required" });
  }

  // validation pass — ab controller chalao
  next();
}

// POST /auth/login — email aur password dono zaroori hain (format/rules nahi — galat email par 401 hi aata hai)
function validateAuth(req, res, next) {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({ message: "Email is required" });
  }

  // password trim nahi karte — spaces bhi password ka hissa ho sakte hain
  if (typeof password !== "string" || password === "") {
    return res.status(400).json({ message: "Password is required" });
  }

  next();
}

// POST /register — email ki shakal + password ke rules
// login par ye rules nahi lagte — warna purane passwords wale users login na kar sakein
function validateRegister(req, res, next) {
  const { email, password } = req.body || {};

  // galat email par user banta hi nahi — 400 aur yahin ruk jao
  const invalidEmail = emailError(email);
  if (invalidEmail) {
    return res.status(400).json({ message: invalidEmail });
  }

  if (typeof password !== "string" || password === "") {
    return res.status(400).json({ message: "Password is required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  // \d = koi bhi ek digit (0-9)
  if (!/\d/.test(password)) {
    return res.status(400).json({ message: "Password must contain at least one number" });
  }

  next();
}

// POST /resend-verification aur POST /verify/resend (page ka form) — sirf email chahiye, register wala hi rule
function validateEmail(req, res, next) {
  const { email } = req.body || {};

  const invalidEmail = emailError(email);
  if (invalidEmail) {
    // form browser se aata hai — use page, API clients ko JSON (respondPage khud faisla karta hai)
    return respondPage(res, 400, { ok: false, title: "Invalid email", message: invalidEmail, showResend: true });
  }

  next();
}

module.exports = {
  validateCreateTask,
  validateAuth,
  validateRegister,
  validateEmail
};
