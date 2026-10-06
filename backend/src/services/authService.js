// auth ka saara kaam yahan — hashing, password check, token banana, email verify ka code
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const Otp = require("../models/Otp");
const config = require("../config");
const emailService = require("./emailService");
const ConflictError = require("../utils/ConflictError");
const UnauthorizedError = require("../utils/UnauthorizedError");
const BadRequestError = require("../utils/BadRequestError");
const ForbiddenError = require("../utils/ForbiddenError");
const TooManyRequestsError = require("../utils/TooManyRequestsError");
const LockedError = require("../utils/LockedError");

// bcrypt ka cost — jitna zyada, utna slow (aur brute force utna mushkil)
// purane cost-10 hashes bhi login par chalte hain — cost hash ke andar likha hota hai
const SALT_ROUNDS = 12;

// access token (JWT) chhota — chori ho bhi jaye to 15 minute mein bekaar
// expire hone par frontend refresh token se chupke se naya le leta hai
const ACCESS_TOKEN_EXPIRES_IN = "15m";

// refresh token lamba — itne din tak dobara login nahi karna padta
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// do tab ek saath refresh karein to doosre ko purana (abhi abhi revoke hua) token milta hai —
// itne waqt ke andar ise chori nahi, race maano (warna dono tab logout ho jaate)
const REFRESH_REUSE_GRACE_MS = 30 * 1000;

// email verify ka code — 6 digit (sirf register ke baad; login par code nahi)
// 5 minute chalta hai, 5 galat koshishon par band, aur ek user ghante mein 3 hi maang sakta hai
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS = 3;
const OTP_WINDOW_MS = 60 * 60 * 1000;
// bcrypt — code sirf 10 lakh mein se ek hai, SHA-256 hota to DB leak par second mein toot jaata
// cost 10 (password wale 12 se kam) — code 5 minute ka hai, har request par 250ms kyun lagayein
const OTP_SALT_ROUNDS = 10;

// account lockout — itne lagataar galat password par account itni der band
// (IP limiter alag hai — ye ek account ko bachata hai, IP limiter bahut saare accounts par hamle ko)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// timing se enumeration na ho — user na mile tab bhi utna hi bcrypt kaam karo jitna mile to hota
// (warna "na-maujood email" 2ms aur "galat password" 220ms mein jawab deta, message ek hone ke bawajood)
// startup par ek dafa banao — har request par nahi
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-dummy-password", SALT_ROUNDS);
const DUMMY_OTP_HASH = bcrypt.hashSync("000000", OTP_SALT_ROUNDS);

// SHA-256 hex — refresh token DB mein isi shakal mein
// bcrypt nahi kyunki token pehle hi 256-bit random hai, aur hash se seedha dhoondna padta hai
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// email ki ek hi shakal — register, verify, resend, login sab isi se dhoondte hain
// ("QA@X.com " aur "qa@x.com" ek hi user; schema bhi lowercase+trim karta hai, lekin dhoondne se pehle khud karna padta hai)
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// naya code banao, hash save karo, ginti badhao — code lautata hai (email ke liye), had poori ho to 429
// purpose: abhi sirf "verify-email" — model mein field hai taake aage koi aur code (jaise password reset) alag rahe
async function issueOtp(userId, purpose) {
  // crypto.randomInt — Math.random andaza lagane layak hai; padStart taake "000123" bhi 6 digit rahe
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
  const now = new Date();
  const windowOpenedAfter = new Date(now.getTime() - OTP_WINDOW_MS);
  // naya code purane ko overwrite karta hai — attempts bhi 0 se
  const freshCode = {
    otpHash,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    attempts: 0,
    purgeAt: new Date(now.getTime() + OTP_WINDOW_MS)
  };

  // ginti aur naya code ek hi query mein — do requests ek saath aayein to bhi 3 se zyada na niklein
  // 1) window chal rahi hai aur 3 se kam maange
  const inWindow = () =>
    Otp.updateOne(
      { user: userId, purpose, windowStart: { $gt: windowOpenedAfter }, requestCount: { $lt: OTP_MAX_REQUESTS } },
      { $set: freshCode, $inc: { requestCount: 1 } }
    );

  let result = await inWindow();

  // 2) ghanta guzar gaya — nayi window, ginti 1 se
  if (result.matchedCount === 0) {
    result = await Otp.updateOne(
      { user: userId, purpose, windowStart: { $lte: windowOpenedAfter } },
      { $set: { ...freshCode, windowStart: now, requestCount: 1 } }
    );
  }

  // 3) pehli dafa — document hi nahi; unique (user, purpose) ki wajah se do creates mein se ek hi bachta hai
  if (result.matchedCount === 0) {
    try {
      await Otp.create({ user: userId, purpose, ...freshCode, windowStart: now, requestCount: 1 });
    } catch (err) {
      if (err.code !== 11000) {
        throw err;
      }
      // document maujood hai — ya to doosri request ne abhi banaya (dobara koshish), ya had poori
      result = await inWindow();
      if (result.matchedCount === 0) {
        throw new TooManyRequestsError("Too many codes requested. Please try again later.");
      }
    }
  }

  return otp;
}

// code check karo — sahi ho to code khatam (ek hi dafa chalta hai), galat ho to `invalid` throw
// har galat soorat (code nahi, expire, koshishen khatam, galat code) mein wahi `invalid` — kya galat tha nahi batate
async function consumeOtp(userId, purpose, otp, invalid) {
  // koshish pehle "book" karo, phir compare — warna 20 parallel requests sab "attempts < 5" dekh letin
  // code ho, expire na hua ho, 5 se kam koshishen — teeno check aur attempts+1 ek hi query mein
  const record = await Otp.findOneAndUpdate(
    {
      user: userId,
      purpose,
      otpHash: { $exists: true },
      expiresAt: { $gt: new Date() },
      attempts: { $lt: OTP_MAX_ATTEMPTS }
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  );

  if (!record) {
    // active code nahi (expire / 5 koshishen poori / pehle hi istemal) — phir bhi utna hi bcrypt kaam
    // warna bina bcrypt foran jawab aata aur waqt se pata chal jaata ke is account par abhi code chal raha hai ya nahi
    await bcrypt.compare(otp, DUMMY_OTP_HASH);
    throw invalid;
  }

  const isMatch = await bcrypt.compare(otp, record.otpHash);

  if (!isMatch) {
    // 5vi galat koshish — code band (sirf yahi code; agar beech mein naya aa gaya to use nahi chhedte)
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await Otp.updateOne({ _id: record._id, otpHash: record.otpHash }, { $unset: { otpHash: 1, expiresAt: 1 } });
    }
    throw invalid;
  }

  // consume bhi atomic — do sahi requests ek saath aayein to sirf ek kamyab
  const consumed = await Otp.updateOne(
    { _id: record._id, otpHash: record.otpHash },
    { $unset: { otpHash: 1, expiresAt: 1 }, $set: { attempts: 0 } }
  );
  if (consumed.modifiedCount === 0) {
    throw invalid;
  }
}

// unverified account dobara register ho — "User registered" (201) nahi, kyunki naya account bana hi nahi
// ek hi jawab, chahe code gaya ho ya ghante ki had (3) poori ho — had ka 429 batata ke yahan unverified account hai
const REGISTER_PENDING_RESPONSE = { message: "If an account exists for this email, a verification code has been sent." };

// POST /register — naya user unverified banta hai, email par verify ka code jaata hai
// lautata hai: { created: true, user } (naya, 201) ya { created: false, message } (pehle se unverified, 200)
async function register({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  // asal password kabhi save nahi hota — sirf uska hash
  // hash pehle — taake naya, unverified aur verified teeno raaston mein bcrypt ka waqt ek jaisa lage
  // (unverified aur verified raaston mein hash use nahi hota, sirf waqt barabar karta hai)
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser && existingUser.isVerified) {
    throw new ConflictError("Email already registered");
  }

  if (existingUser) {
    // unverified account — kisi ne kisi aur ka email "pehle se" register kar liya ho to asli malik phans jaata
    // is liye 409 nahi: sirf naya code. password NAHI badalte — koi bhi dobara register karke kisi ka password
    // na badal sake; asli (aakhri) password waise bhi verify ke waqt code ke saath lagta hai (verifyEmail)
    let otp;
    try {
      otp = await issueOtp(existingUser._id, "verify-email");
    } catch (err) {
      // ghante mein 3 ki had — email nahi, lekin jawab wahi (spam bhi ruka, enumeration bhi nahi)
      if (err instanceof TooManyRequestsError) {
        return { created: false, ...REGISTER_PENDING_RESPONSE };
      }
      throw err;
    }
    emailService.sendOtpEmail(existingUser.email, otp, "verify-email");

    return { created: false, ...REGISTER_PENDING_RESPONSE };
  }

  const user = await User.create({
    email: normalizedEmail,
    password: passwordHash,
    isVerified: false
  });

  // user save hone ke baad hi code — save fail ho to code bekaar hota
  // naya user hai, ginti 0 se — is liye yahan 429 nahi aa sakta
  const otp = await issueOtp(user._id, "verify-email");

  // await nahi — Gmail ko 1-3 second lagte hain, response email ka intezar na kare
  // (sendOtpEmail apne errors khud pakadta hai, isliye unhandled rejection nahi hoga)
  emailService.sendOtpEmail(user.email, otp, "verify-email");

  return { created: true, user };
}

// verify-email ki har galti ka ek hi jawab — "user nahi", "pehle se verified", "galat/expire code" alag hon
// to koi bhi email daal kar pata kar le ke account hai ya nahi
const INVALID_VERIFY_CODE = "Invalid or expired code";

// POST /verify-email — register ke baad email par aaya code + password
// password YAHAN lagta hai, register par nahi — code sirf email ka malik dekh sakta hai, to aakhri password usi ka
// (warna koi kisi aur ka email apne password se register kar leta, asli malik code daalta, aur account attacker ka)
async function verifyEmail({ email, otp, password }) {
  const invalid = new BadRequestError(INVALID_VERIFY_CODE);

  const user = await User.findOne({ email: normalizeEmail(email) });
  // pehle se verified ho to bhi wahi jawab — uska koi "verify-email" code hota hi nahi
  if (!user || user.isVerified) {
    // asli code check jitna waqt — warna jaldi jawab bata deta ke yahan unverified account nahi hai
    await bcrypt.compare(otp, DUMMY_OTP_HASH);
    throw invalid;
  }

  await consumeOtp(user._id, "verify-email", otp, invalid);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const verified = await User.findOneAndUpdate(
    { _id: user._id, isVerified: false },
    { $set: { isVerified: true, password: passwordHash } },
    { returnDocument: "after" }
  );
  // beech mein kisi aur request ne verify kar diya (code ek hi tha, to ye hona mushkil) — dobara login karwao
  if (!verified) {
    throw invalid;
  }

  // verify ke saath hi login — code (email ka malik) + abhi chuna hua password, dono saabit; dobara password kyun poochein
  const token = signAccessToken(verified);
  const refreshToken = await issueRefreshToken(verified._id);

  return { message: "Email verified. You are now logged in.", token, refreshToken, user: verified };
}

// har halat mein yahi ek jawab — "nahi hai", "verified hai", "bhej diya" aur "had poori" alag alag hon
// to koi bhi email daal kar pata kar le ke account hai ya nahi (account enumeration)
const RESEND_RESPONSE = { message: "If that account exists and is not verified, a new verification code has been sent" };

// POST /resend-verification — naya verify code (purana foran band)
async function resendVerification(email) {
  const user = await User.findOne({ email: normalizeEmail(email) });

  // user na ho ya pehle se verified ho — kuch nahi bhejna, lekin jawab wahi
  if (!user || user.isVerified) {
    // naya code banane (bcrypt) jitna waqt — warna jaldi jawab bata deta ke unverified account nahi hai
    await bcrypt.hash("000000", OTP_SALT_ROUNDS);
    return RESEND_RESPONSE;
  }

  let otp;
  try {
    otp = await issueOtp(user._id, "verify-email");
  } catch (err) {
    // ghante mein 3 ki had — email nahi jaati, lekin 429 bhi nahi (warna 429 batata ke unverified account hai)
    if (err instanceof TooManyRequestsError) {
      return RESEND_RESPONSE;
    }
    throw err;
  }

  // background mein — register ki tarah response email ka intezar nahi karta
  emailService.sendOtpEmail(user.email, otp, "verify-email");

  return RESEND_RESPONSE;
}

// band account ka jawab — kitne minute baaki (upar round, "0 minutes" kabhi nahi) + Retry-After seconds
function lockedError(lockUntil) {
  const remainingMs = lockUntil.getTime() - Date.now();
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return new LockedError(
    `Account locked due to too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    Math.max(1, Math.ceil(remainingMs / 1000))
  );
}

// galat password — ginti atomic +1; 5 par account band (aur 423)
async function recordFailedLogin(userId) {
  // $inc ek hi query mein — 10 parallel galat requests bhi har ek gini jaati hain (padh kar +1 likhne mein ginti chhoot jaati)
  // shart: abhi band na ho — parallel requests jo lock se pehle padh chuki thin, lock ke baad ginti na chadhayein
  // (warna lock khatam hote hi ginti 5+ par hoti aur pehli hi galti par phir lock)
  const updated = await User.findOneAndUpdate(
    { _id: userId, $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }] },
    { $inc: { failedLoginAttempts: 1 } },
    { returnDocument: "after" }
  );

  if (!updated) {
    // beech mein kisi aur request ne band kar diya — wahi lock batao (user mit gaya ho to 401)
    const current = await User.findById(userId, { lockUntil: 1 });
    if (current && current.lockUntil && current.lockUntil > new Date()) {
      throw lockedError(current.lockUntil);
    }
    throw new UnauthorizedError("Invalid email or password");
  }

  if (updated.failedLoginAttempts < MAX_LOGIN_ATTEMPTS) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // 5vi galti — band karo, aur ginti 0 se (lock khatam hone par phir 5 koshishen)
  // shart: abhi pehle se band na ho — do parallel 5vi galtiyan lock ka waqt aage na khiskayein
  const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  await User.updateOne(
    { _id: userId, $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }] },
    { $set: { lockUntil, failedLoginAttempts: 0 } }
  );
  const current = await User.findById(userId, { lockUntil: 1 });
  throw lockedError((current && current.lockUntil) || lockUntil);
}

// email + password check — login isi par chalta hai
// order: user → band to nahi? → password (galat par ginti/lock) → sahi par ginti reset → verified?
async function checkCredentials({ email, password }) {
  const user = await User.findOne({ email: normalizeEmail(email) });

  // user na mile ya password galat ho — dono mein ek hi message,
  // taake koi andaza na laga sake ke kaun sa email registered hai
  // na-maujood email ka lockout nahi rakhte (fake accounts ki halat DB mein nahi) — IP limiter unhe rokta hai
  if (!user) {
    // message hi nahi, waqt bhi ek jaisa — bcrypt na chale to jawab 200ms pehle aata aur email registered na hona pata chal jaata
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw new UnauthorizedError("Invalid email or password");
  }

  // band hai to SAHI password bhi nahi — password check se pehle (band waqt mein ginti bhi nahi badhti)
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw lockedError(user.lockUntil);
  }

  // bcrypt hash se salt khud nikaal kar compare karta hai
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    await recordFailedLogin(user._id);
  }

  // sahi password — lagataar galtiyon ki ginti khatam (purana khatam hua lock bhi saaf)
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
  }

  // password check ke BAAD — warna galat password wala bhi jaan leta ke email registered hai
  if (!user.isVerified) {
    // task ke mutabiq — user ko batao ke email check kare
    throw new ForbiddenError("Please verify your email with the code we sent before logging in.");
  }

  return user;
}

// har protected request par — token sahi hone ke bawajood user delete ho chuka ho to session khatam
// (warna access token 15 minute tak chalta, aur delete hue user ke naam par tasks ban jaate)
async function userExists(userId) {
  return Boolean(await User.exists({ _id: userId }));
}

// POST /auth/login — email + password sahi aur email verified ho to tokens
async function login({ email, password }) {
  const user = await checkCredentials({ email, password });

  const token = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user._id);

  return { token, refreshToken, user };
}

// sub = token kis user ka hai
function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    // verify sirf HS256 maanta hai — sign mein bhi saaf likho, library ke default par bharosa nahi
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  });
}

// naya refresh token — raw cookie ke liye, DB mein sirf hash (verification token wala hi pattern)
async function issueRefreshToken(userId) {
  const refreshToken = crypto.randomBytes(32).toString("hex");

  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  });

  return refreshToken;
}

// POST /auth/refresh — purana refresh token band, naya access + naya refresh token (rotation)
async function refreshSession(refreshToken) {
  // har galat soorat mein ek hi message — kya galat tha ye batane ki zaroorat nahi
  const invalid = new UnauthorizedError("Session expired. Please log in again.");

  if (!refreshToken) {
    throw invalid;
  }

  const tokenHash = hashToken(refreshToken);
  const now = new Date();

  // dhoondna aur revoke karna ek hi query mein — do requests ek saath aayein to sirf ek kamyab ho
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } }
  );

  if (!current) {
    const used = await RefreshToken.findOne({ tokenHash });

    // pehle hi istemal (revoke) ho chuka token dobara aaya — kisi ne chura liya ho sakta hai
    // grace ke baad aaya to chori maano: is user ke SAARE refresh tokens band (har device se logout)
    if (used && used.revokedAt && now - used.revokedAt > REFRESH_REUSE_GRACE_MS) {
      await RefreshToken.updateMany(
        { user: used.user, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } }
      );
    }

    throw invalid;
  }

  // token sahi tha lekin user delete ho chuka
  const user = await User.findById(current.user);
  if (!user) {
    throw invalid;
  }

  return {
    token: signAccessToken(user),
    refreshToken: await issueRefreshToken(user._id),
    user
  };
}

// POST /auth/logout — refresh token band; dobara refresh nahi ho sakega
// token na ho ya pehle hi band ho to bhi theek (logout hamesha kamyab)
async function logout(refreshToken) {
  if (!refreshToken) {
    return;
  }

  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  register,
  verifyEmail,
  login,
  refreshSession,
  logout,
  userExists,
  // controller ko cookie ki umar isi se — DB expiry ke barabar
  REFRESH_TOKEN_TTL_MS,
  resendVerification
};
