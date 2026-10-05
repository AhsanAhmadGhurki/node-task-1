// request validation — controller tak pahunchne se pehle body check karo

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

// bcrypt sirf pehle 72 BYTES padhta hai — lamba password ho to 72 ke baad wala hissa koi bhi ho, login ho jaata
// isliye had 72 bytes (characters nahi — "é" jaise characters 2 bytes ke hote hain); bahut lamba body bhi yahin ruk jaata
const MAX_PASSWORD_BYTES = 72;

function passwordTooLong(password) {
  return Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES;
}

// naya password (register + verify-email) — 8+ characters, kam se kam ek letter aur ek number, 72 bytes tak,
// aage/peeche space nahi ("        1" jaisa password — 8 spaces + 1 — warna chal jaata)
// frontend (utils/helpers.passwordRuleError) bhi yahi rules submit se pehle check karta hai
// login par ye rules nahi — purane passwords wale users login na kar sakein
function newPasswordError(password) {
  const fieldError = stringFieldError(password, "Password", { trim: false });
  if (fieldError) {
    return fieldError;
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (passwordTooLong(password)) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes`;
  }

  // copy-paste mein aage peeche space aa jaye to user ko pata hi nahi chalta — login par wo space type nahi karta
  if (password !== password.trim()) {
    return "Password must not start or end with a space";
  }

  // \p{L} = koi bhi letter (a-z, A-Z, é, ب …) — sirf ASCII nahi
  if (!/\p{L}/u.test(password)) {
    return "Password must contain at least one letter";
  }

  // \d = koi bhi ek digit (0-9)
  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
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

// task title ki had — warna 100kb tak ka title save ho jaata (DB bharo, UI todo); trim ke baad gina jaata hai
const MAX_TITLE_LENGTH = 200;

function titleError(title) {
  const fieldError = stringFieldError(title, "Title", { trim: true });
  if (fieldError) {
    return fieldError;
  }

  if (title.trim().length > MAX_TITLE_LENGTH) {
    return `Title must be at most ${MAX_TITLE_LENGTH} characters`;
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

  // title na ho, string na ho, sirf spaces ho ya 200 se lamba ho to 400 — next() nahi chalega, controller tak nahi jayega
  const invalidTitle = titleError(title);
  if (invalidTitle) {
    return res.status(400).json({ message: invalidTitle });
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
    const invalidTitle = titleError(title);
    if (invalidTitle) {
      return res.status(400).json({ message: invalidTitle });
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

  // 72 bytes se lamba password kabhi set hi nahi ho sakta — bcrypt tak bhejne ki zaroorat nahi
  if (passwordTooLong(password)) {
    return res.status(400).json({ message: `Password must be at most ${MAX_PASSWORD_BYTES} bytes` });
  }

  next();
}

// POST /verify-email — email + bilkul 6 digit ka code (string; 123456 number nahi, "12 34 56" nahi)
// + password (register wale rules) — verify ke waqt yahi account par lagta hai
function validateOtpVerify(req, res, next) {
  const { email, otp, password } = req.body || {};

  const emailFieldError = stringFieldError(email, "Email", { trim: true });
  if (emailFieldError) {
    return res.status(400).json({ message: emailFieldError });
  }

  const otpFieldError = stringFieldError(otp, "Code", { trim: false });
  if (otpFieldError) {
    return res.status(400).json({ message: otpFieldError });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: "Code must be 6 digits" });
  }

  const invalidPassword = newPasswordError(password);
  if (invalidPassword) {
    return res.status(400).json({ message: invalidPassword });
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

  const invalidPassword = newPasswordError(password);
  if (invalidPassword) {
    return res.status(400).json({ message: invalidPassword });
  }

  next();
}

// POST /resend-verification — sirf email chahiye, register wala hi rule
function validateEmail(req, res, next) {
  const { email } = req.body || {};

  const invalidEmail = emailError(email);
  if (invalidEmail) {
    return res.status(400).json({ message: invalidEmail });
  }

  next();
}

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  validateAuth,
  validateOtpVerify,
  validateRegister,
  validateEmail
};
