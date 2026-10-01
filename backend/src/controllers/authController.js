// controller ka kaam: req se data nikalo, service ko do, res bhejo
const authService = require("../services/authService");

// POST /auth/register — body: { "email": "...", "password": "..." }
async function register(req, res, next) {
  try {
    // validateAuth pehle hi check kar chuka hai — email aur password hamesha string hain
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
async function verifyEmail(req, res, next) {
  try {
    await authService.verifyEmail(req.params.token);

    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    next(err);
  }
}

// POST /resend-verification — body: { "email": "..." }
async function resendVerification(req, res, next) {
  try {
    const { message } = await authService.resendVerification(req.body.email);

    res.status(200).json({ message });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification
};
