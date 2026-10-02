// controller ka kaam: req se data nikalo, service ko do, res bhejo
const authService = require("../services/authService");
const { respondPage } = require("../views/verifyPage");

// POST /register — body: { "email": "...", "password": "..." }
async function register(req, res, next) {
  try {
    // validateRegister pehle hi check kar chuka hai — email sahi shakal ki, password rules ke mutabiq
    const { email, password } = req.body;

    const user = await authService.register({ email, password });

    // 201 = naya user ban gaya — password toJSON mein hat jaata hai
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

// POST /auth/login — body: { "email": "...", "password": "..." }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { token, user } = await authService.login({ email, password });

    res.status(200).json({ token, user });
  } catch (err) {
    next(err);
  }
}

// GET /verify/:token — email wala link yahan aata hai
// browser (email ka link) ko HTML page, API client (curl/tests) ko JSON — respondPage Accept header se faisla karta hai
async function verifyEmail(req, res, next) {
  try {
    await authService.verifyEmail(req.params.token);

    respondPage(res, 200, {
      ok: true,
      title: "Email verified",
      message: "Email verified successfully",
      pageMessage: "Your email has been verified. You can now log in."
    });
  } catch (err) {
    // 400/410 jaise jaane pehchane errors — user ko saaf page aur naya link mangwane ka form; baaki (500) central handler ko
    if (!err.statusCode) {
      return next(err);
    }
    respondPage(res, err.statusCode, { ok: false, title: "Verification failed", message: err.message, showResend: true });
  }
}

// POST /resend-verification (API, body JSON) aur POST /verify/resend (page ka form) — body: { "email": "..." }
async function resendVerification(req, res, next) {
  try {
    const { message } = await authService.resendVerification(req.body.email);

    respondPage(res, 200, { ok: true, title: "Check your email", message });
  } catch (err) {
    // 429 (cooldown) waghaira — form wale ko page, dobara try karne ke liye form ke saath
    if (!err.statusCode) {
      return next(err);
    }
    respondPage(res, err.statusCode, { ok: false, title: "Please wait", message: err.message, showResend: true });
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification
};
