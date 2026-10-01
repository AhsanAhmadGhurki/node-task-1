// Express app yahan banti hai — server start index.js karta hai
const express = require("express");
const loggingMiddleware = require("./middleware/logger");
const apiKeyMiddleware = require("./middleware/apiKey");
const notFoundMiddleware = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");

const app = express();

// JSON body padhne ke liye
app.use(express.json());

// har request log karo — routes se pehle hona zaroori hai
app.use(loggingMiddleware);

// logger ke baad — taake reject hone wali requests bhi log hon
app.use(apiKeyMiddleware);

// /tasks se shuru hone wali har request taskRoutes ke paas
app.use("/tasks", taskRoutes);

// koi route match nahi hua
app.use(notFoundMiddleware);

// error handler hamesha sabse aakhir mein
app.use(errorHandler);

module.exports = app;