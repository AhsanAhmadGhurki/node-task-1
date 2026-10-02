// controller ka kaam: req se data nikalo, service ko do, res bhejo
const authService = require("../services/authService");
const { respondPage } = require("../views/verifyPage");
const config = require("../config");

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

// refresh token ki cookie — httpOnly: JavaScript parh hi nahi sakti (XSS se chori nahi)
// path /auth — sirf /auth/refresh aur /auth/logout par jaati hai, /tasks waghaira par nahi
const REFRESH_COOKIE = "refreshToken";
const refreshCookieOptions = {
  httpOnly: true,
  // dusri site se aayi request par cookie nahi jaati (CSRF se bachao)
  sameSite: "strict",
  // https par hi bhejo — localhost (http) par development ke liye band
  secure: config.appUrl.startsWith("https://"),
  path: "/auth"
};

function setRefreshCookie(res, refreshToken) {
  // maxAge milliseconds mein — DB wali expiry ke barabar
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions, maxAge: authService.REFRESH_TOKEN_TTL_MS });
}

// POST /auth/login — body: { "email": "...", "password": "..." }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const { token, refreshToken, user } = await authService.login({ email, password });

    // refresh token sirf cookie mein — JSON body mein kabhi nahi
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ token, user });
  } catch (err) {
    next(err);
  }
}

// POST /auth/refresh — body nahi, refresh token cookie se aata hai
async function refresh(req, res, next) {
  try {
    const { token, refreshToken, user } = await authService.refreshSession(req.cookies[REFRESH_COOKIE]);

    // rotation — naya refresh token cookie mein, purana DB mein band ho chuka
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ token, user });
  } catch (err) {
    // fail par cookie NAHI mitaate — do tab ek saath refresh karein to doosre tab ki fail request
    // pehle tab ki abhi abhi aayi nayi (sahi) cookie mita deti aur dono logout ho jaate
    // galat cookie pade rehne se koi nuqsan nahi — agla login use overwrite kar deta hai
    next(err);
  }
}

// POST /auth/logout — refresh token band aur cookie saaf
async function logout(req, res, next) {
  try {
    await authService.logout(req.cookies[REFRESH_COOKIE]);

    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    res.status(200).json({ message: "Logged out" });
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
  refresh,
  logout,
  verifyEmail,
  resendVerification
};
