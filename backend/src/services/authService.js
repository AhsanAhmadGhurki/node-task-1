// auth ka saara kaam yahan — hashing, password check, token banana, email verification
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config");
const emailService = require("./emailService");
const ConflictError = require("../utils/ConflictError");
const UnauthorizedError = require("../utils/UnauthorizedError");
const GoneError = require("../utils/GoneError");
const BadRequestError = require("../utils/BadRequestError");
const ForbiddenError = require("../utils/ForbiddenError");

// bcrypt ka cost — jitna zyada, utna slow (aur brute force utna mushkil)
// purane cost-10 hashes bhi login par chalte hain — cost hash ke andar likha hota hai
const SALT_ROUNDS = 12;

// token kitni der chalega
const TOKEN_EXPIRES_IN = "1h";

// verification link exactly 24 ghante chalega
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
    verificationTokenExpires: expires
  });

  // user save hone ke baad hi link bhejo — save fail ho to link bekaar hota
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
  user.verificationTokenHash = tokenHash;
  user.verificationTokenExpires = expires;
  await user.save();

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

  // sub = token kis user ka hai
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: TOKEN_EXPIRES_IN
  });

  return { token, user };
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification
};
