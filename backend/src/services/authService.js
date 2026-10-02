// auth ka saara kaam yahan — hashing, password check, token banana, email verification
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const config = require("../config");
const emailService = require("./emailService");
const ConflictError = require("../utils/ConflictError");
const UnauthorizedError = require("../utils/UnauthorizedError");
const GoneError = require("../utils/GoneError");
const BadRequestError = require("../utils/BadRequestError");
const ForbiddenError = require("../utils/ForbiddenError");
const TooManyRequestsError = require("../utils/TooManyRequestsError");

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

// verification link exactly 24 ghante chalega
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// ek email par 60 second mein sirf ek verification email — IP badal kar bhi spam na ho sake
const RESEND_COOLDOWN_MS = 60 * 1000;

// SHA-256 hex — DB mein token ki jagah ye save hota hai
// bcrypt nahi kyunki token pehle hi 256-bit random hai, aur hash se seedha dhoondna padta hai
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// naya verification token — raw link ke liye, hash aur expiry DB ke liye
function createVerificationToken() {
  // 32 random bytes → 64 characters ka hex string
  const token = crypto.randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: hashToken(token),
    expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
  };
}

async function register({ email, password }) {
  // schema bhi lowercase karta hai — lekin dhoondne se pehle khud karna padta hai
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  // asal password kabhi save nahi hota — sirf uska hash
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { token, tokenHash, expires } = createVerificationToken();

  const user = await User.create({
    email: normalizedEmail,
    password: passwordHash,
    isVerified: false,
    verificationTokenHash: tokenHash,
    verificationTokenExpires: expires,
    // register bhi email bhejta hai — foran resend par cooldown lagay
    verificationEmailSentAt: new Date()
  });

  // user save hone ke baad hi link bhejo — save fail ho to link bekaar hota
  // await nahi — Gmail ko 1-3 second lagte hain, response email ka intezar na kare
  // (sendVerificationEmail apne errors khud pakadta hai, isliye unhandled rejection nahi hoga)
  emailService.sendVerificationEmail(user.email, token);

  return user;
}

async function verifyEmail(token) {
  // hamara token hamesha 64 hex characters ka hota hai — kuch aur ho to DB tak jaane ki zaroorat hi nahi
  if (!/^[a-f0-9]{64}$/.test(token)) {
    throw new BadRequestError("Invalid verification link");
  }

  const tokenHash = hashToken(token);
  const user = await User.findOne({ verificationTokenHash: tokenHash });

  // istemal ho chuka (verify ke baad hash delete), resend se badal gaya, ya kabhi tha hi nahi — 410
  if (!user) {
    throw new GoneError("Verification link is invalid or has already been used");
  }

  if (user.verificationTokenExpires < new Date()) {
    // message task ke mutabiq hubahu
    throw new GoneError("link expired, request a new one.");
  }

  // verify karo aur token hata do — dobara isi link se kuch nahi hoga
  // filter mein hash bhi — do requests ek saath aayein to sirf ek hi kamyab ho
  const result = await User.updateOne(
    { _id: user._id, verificationTokenHash: tokenHash },
    {
      $set: { isVerified: true },
      $unset: { verificationTokenHash: "", verificationTokenExpires: "" }
    }
  );

  if (result.modifiedCount === 0) {
    throw new GoneError("Verification link is invalid or has already been used");
  }
}

async function resendVerification(email) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  // user na ho to bhi wahi jawab — taake koi andaza na laga sake ke email registered hai ya nahi
  if (!user) {
    return { message: "If that account exists and is not verified, a new verification link has been sent" };
  }

  if (user.isVerified) {
    return { message: "Email is already verified" };
  }

  // naya token — purana hash overwrite ho jaata hai, isliye purana link foran band
  const { token, tokenHash, expires } = createVerificationToken();
  const now = new Date();
  const cooldownStart = new Date(now.getTime() - RESEND_COOLDOWN_MS);

  // cooldown check aur update ek hi query mein — do requests ek saath aayein to bhi sirf ek email jaye
  const result = await User.updateOne(
    {
      _id: user._id,
      isVerified: false,
      $or: [
        { verificationEmailSentAt: { $exists: false } },
        { verificationEmailSentAt: { $lte: cooldownStart } }
      ]
    },
    {
      $set: {
        verificationTokenHash: tokenHash,
        verificationTokenExpires: expires,
        verificationEmailSentAt: now
      }
    }
  );

  if (result.modifiedCount === 0) {
    // kitne second baaki — user ko bata do kab dobara try kare
    const sentAt = user.verificationEmailSentAt ? user.verificationEmailSentAt.getTime() : now.getTime();
    const waitSeconds = Math.max(1, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now.getTime()) / 1000));
    throw new TooManyRequestsError(`Please wait ${waitSeconds} seconds before requesting another verification email.`);
  }

  // background mein — register ki tarah response email ka intezar nahi karta
  emailService.sendVerificationEmail(user.email, token);

  return { message: "Verification link sent" };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  // user na mile ya password galat ho — dono mein ek hi message,
  // taake koi andaza na laga sake ke kaun sa email registered hai
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // bcrypt hash se salt khud nikaal kar compare karta hai
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // password check ke BAAD — warna galat password wala bhi jaan leta ke email registered hai
  if (!user.isVerified) {
    // task ke mutabiq — user ko batao ke email check kare
    throw new ForbiddenError("Please check your email to verify your account before logging in.");
  }

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
  login,
  refreshSession,
  logout,
  // controller ko cookie ki umar isi se — DB expiry ke barabar
  REFRESH_TOKEN_TTL_MS,
  verifyEmail,
  resendVerification
};
