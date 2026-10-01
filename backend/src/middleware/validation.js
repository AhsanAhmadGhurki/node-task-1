// request validation — controller tak pahunchne se pehle body check karo

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

// POST /auth/register aur /auth/login — email aur password dono zaroori hain
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

// POST /auth/register — validateAuth wale checks + password ke rules
// login par ye rules nahi lagte — warna purane passwords wale users login na kar sakein
function validateRegister(req, res, next) {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({ message: "Email is required" });
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

// POST /resend-verification — sirf email chahiye
function validateEmail(req, res, next) {
  const { email } = req.body || {};

  if (typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({ message: "Email is required" });
  }

  next();
}

module.exports = {
  validateCreateTask,
  validateAuth,
  validateRegister,
  validateEmail
};
