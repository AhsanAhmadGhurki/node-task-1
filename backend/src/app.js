// Express app yahan banti hai — server start index.js karta hai
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const loggingMiddleware = require("./middleware/logger");
const apiKeyMiddleware = require("./middleware/apiKey");
const authMiddleware = require("./middleware/auth");
const notFoundMiddleware = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const config = require("./config");
const userRoutes = require("./routes/userRoutes");

const app = express();

// security headers sabse pehle — taake malformed JSON wala 400 bhi in headers ke saath jaaye
// (express.json fail ho to request seedha errorHandler par jaati hai, baad wale middleware skip)
app.use(helmet());

// JSON body padhne ke liye
app.use(express.json());

// cookies padhne ke liye — refresh token httpOnly cookie mein aata hai (req.cookies)
app.use(cookieParser());

// har request log karo — routes se pehle hona zaroori hai
app.use(loggingMiddleware);

// logger ke baad — taake reject hone wali requests bhi log hon
app.use(apiKeyMiddleware);

// avatars ki tasveerein (<img src="/api/uploads/avatars/...">) — API key ke BAAD (proxy lagata hai), token nahi
// (img tag Authorization header nahi bhej sakta). safe kyun: naam aur extension server ka banaya hua,
// extension sirf .jpg/.png/.webp (upload.js), aur helmet ka "nosniff" browser ko andaza laga kar HTML chalane nahi deta
// index: false — folder ki list nahi; file na mile to aage 404 handler
app.use("/uploads/avatars", express.static(config.avatarUploadDir, { index: false, dotfiles: "ignore" }));

// /tasks se shuru hone wali har request — pehle token check, phir taskRoutes ke paas
app.use("/tasks", authMiddleware, taskRoutes);

// saare auth routes — /auth/register, /auth/verify-email, /auth/resend-verification, /auth/login, /auth/refresh, /auth/logout
// (register, verify-email, resend-verification ke purane root paths bhi — alias)
app.use(authRoutes);

// /user/* — logged-in user ke apne kaam (abhi: avatar upload)
// authMiddleware Multer se PEHLE — upload.js file ka naam req.user.id se banata hai
app.use("/user", authMiddleware, userRoutes);

// koi route match nahi hua
app.use(notFoundMiddleware);

// error handler hamesha sabse aakhir mein
app.use(errorHandler);

module.exports = app;