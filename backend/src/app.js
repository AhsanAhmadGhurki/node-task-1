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
const verificationRoutes = require("./routes/verificationRoutes");

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

// GET /verify/:token — API key se pehle, kyunki email ka link browser mein bina header ke khulta hai
app.use(verificationRoutes.publicRouter);

// logger ke baad — taake reject hone wali requests bhi log hon
app.use(apiKeyMiddleware);

// /tasks se shuru hone wali har request — pehle token check, phir taskRoutes ke paas
app.use("/tasks", authMiddleware, taskRoutes);

// POST /register aur POST /auth/login
app.use(authRoutes);

// POST /resend-verification
app.use(verificationRoutes.router);

// koi route match nahi hua
app.use(notFoundMiddleware);

// error handler hamesha sabse aakhir mein
app.use(errorHandler);

module.exports = app;