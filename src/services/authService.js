// auth ka saara kaam yahan — hashing, password check, token banana
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config");
const ConflictError = require("../utils/ConflictError");
const UnauthorizedError = require("../utils/UnauthorizedError");

// bcrypt ka cost — jitna zyada, utna slow (aur brute force utna mushkil)
const SALT_ROUNDS = 10;

// token kitni der chalega
const TOKEN_EXPIRES_IN = "1h";

async function register({ email, password }) {
  // schema bhi lowercase karta hai — lekin dhoondne se pehle khud karna padta hai
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  // asal password kabhi save nahi hota — sirf uska hash
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return User.create({ email: normalizedEmail, password: passwordHash });
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

  // sub = token kis user ka hai
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: TOKEN_EXPIRES_IN
  });

  return { token, user };
}

module.exports = {
  register,
  login
};
