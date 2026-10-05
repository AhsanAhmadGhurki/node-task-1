// request validation — controller tak pahunchne se pehle body check karo
const { respondPage } = require("../views/verifyPage");

// simple email shakal: kuch@kuch.kuch — spaces nahi, ek @, aur @ ke baad domain mein dot
// poori RFC wali validation nahi — asal saboot verification email hi hai
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// field na ho (undefined/null/khaali) to "required", ho lekin string na ho (object, array, number) to "must be a string"
// dono 400 hain — bas user ko saaf pata chale ke galti kya hai
// trim: email mein sirf spaces = khaali, password mein spaces bhi password ka hissa hain
function stringFieldError(value, field, { trim }) {
  if (value === undefined || value === null) {
    return `${field} is required`;
  }

  if (typeof value !== "string") {
    return `${field} must be a string`;
  }

  if ((trim ? value.trim() : value) === "") {
    return `${field} is required`;
  }

  return null;
}

// email ka missing / galat format — dono jagah (register, resend) ek hi rule
// error message lautata hai, sab theek ho to null
function emailError(email) {
  const fieldError = stringFieldError(email, "Email", { trim: true });
  if (fieldError) {
    return fieldError;
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return "Please enter a valid email address";
  }

  return null;
}

// completed sirf asli boolean — "true", 1, null jaisi values Mongoose chupke se true/null bana deta tha
// bheja hi na ho (undefined) to theek — create par default false, update par woh field badalti hi nahi
function completedError(completed) {
  if (completed !== undefined && typeof completed !== "boolean") {
    return "Completed must be true or false";
  }

  return null;
}

// POST /tasks — title zaroori hai, completed optional
function validateCreateTask(req, res, next) {
  // body na bheji ho to Express 5 mein req.body undefined hota hai — isliye || {}
  const { title, completed } = req.body || {};

  // title na ho, string na ho, ya sirf spaces ho to 400 — next() nahi chalega, controller tak nahi jayega
  const titleError = stringFieldError(title, "Title", { trim: true });
  if (titleError) {
    return res.status(400).json({ message: titleError });
  }

  const invalidCompleted = completedError(completed);
  if (invalidCompleted) {
    return res.status(400).json({ message: invalidCompleted });
  }

  // validation pass — ab controller chalao
  next();
}

// PUT /tasks/:id — partial update, lekin kam se kam ek field to ho
// jo field bheji hai woh create jaise hi rules par chale — 123 ka "123" ya null save na ho
function validateUpdateTask(req, res, next) {
  const { title, completed } = req.body || {};

  if (title === undefined && completed === undefined) {
    return res.status(400).json({ message: "Provide title or completed to update" });
  }

  if (title !== undefined) {
    // null bhi yahan aata hai — stringFieldError use "Title is required" deta hai
    const titleError = stringFieldError(title, "Title", { trim: true });
    if (titleError) {
      return res.status(400).json({ message: titleError });
    }
  }

  const invalidCompleted = completedError(completed);
  if (invalidCompleted) {
    return res.status(400).json({ message: invalidCompleted });
  }

  next();
}

// POST /auth/login — email aur password dono zaroori hain (format/rules nahi — galat email par 401 hi aata hai)
function validateAuth(req, res, next) {
  const { email, password } = req.body || {};

  const emailFieldError = stringFieldError(email, "Email", { trim: true });
  if (emailFieldError) {
    return res.status(400).json({ message: emailFieldError });
  }

  // password trim nahi karte — spaces bhi password ka hissa ho sakte hain
  const passwordFieldError = stringFieldError(password, "Password", { trim: false });
  if (passwordFieldError) {
    return res.status(400).json({ message: passwordFieldError });
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

  const passwordFieldError = stringFieldError(password, "Password", { trim: false });
  if (passwordFieldError) {
    return res.status(400).json({ message: passwordFieldError });
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
  validateUpdateTask,
  validateAuth,
  validateRegister,
  validateEmail
};
