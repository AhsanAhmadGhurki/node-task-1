// Express app yahan banti hai — server start index.js karta hai
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./docs/openapi");
const loggingMiddleware = require("./middleware/logger");
const apiKeyMiddleware = require("./middleware/apiKey");
const authMiddleware = require("./middleware/auth");
const notFoundMiddleware = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const fileRoutes = require("./routes/fileRoutes");
const orgRoutes = require("./routes/orgRoutes");
const invitationRoutes = require("./routes/invitationRoutes");

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

// API docs — API key se PEHLE: browser page khole to x-api-key header nahi bhej sakta (page hi na khulta)
// sirf docs public hain; "Try it out" wali har request phir bhi apiKeyMiddleware se guzarti hai (key Authorize mein)
// persistAuthorization false — key/token sirf page ki memory mein; refresh ya tab band par mit jaate hain
// (true hota to localStorage mein saaf likhe rehte — shared computer par agla user wahi key/token istemal kar leta)
app.get("/api-docs.json", (req, res) => res.json(openapiSpec));
// sirf docs page ka CSP — "Try it out" tasveer (GET /files) ko blob: URL bana kar <img> mein dikhata hai,
// helmet ka default img-src ('self' data:) use rok deta (toota icon). baaki API ka CSP waisa hi
app.use("/api-docs", helmet.contentSecurityPolicy({ directives: { "img-src": ["'self'", "data:", "blob:"] } }));
app.use("/api-docs", swaggerUi.serve,swaggerUi.setup(openapiSpec, {
  customSiteTitle: "TaskDesk API Docs",
  swaggerOptions: { persistAuthorization: false }
}));

// logger ke baad — taake reject hone wali requests bhi log hon
app.use(apiKeyMiddleware);

// uploads/ ab express.static se serve NAHI hota — static sirf "file disk par hai?" dekhta hai, "kis ki hai?" nahi:
// jiske paas URL (ya andaza lagaya hua naam) ho, use file mil jaati. ab har file GET /files/:fileId se (neeche)

// /tasks se shuru hone wali har request — pehle token check, phir taskRoutes ke paas
app.use("/tasks", authMiddleware, taskRoutes);

// saare auth routes — /auth/register, /auth/verify-email, /auth/resend-verification, /auth/login, /auth/refresh, /auth/logout
// (register, verify-email, resend-verification ke purane root paths bhi — alias)
app.use(authRoutes);

// /user/* — logged-in user ke apne kaam (abhi: avatar upload)
// authMiddleware Multer se PEHLE — upload.js file ka naam req.user.id se banata hai
app.use("/user", authMiddleware, userRoutes);

// /tickets/* — support tickets aur unke attachments; authMiddleware Multer se PEHLE (ticketUpload.js bhi req.user.id se naam banata hai)
// attachments ka download /files/:fileId se (attachment._id = fileId)
app.use("/tickets", authMiddleware, ticketRoutes);

// /files/:fileId — har uploaded file (avatar, attachment) yahin se: token (401) → hai? (404) → tumhari? (403) → stream
// ya 10 minute ka signed link (<img src> header nahi bhej sakta) — is liye auth yahan nahi, fileRoutes har route par lagata hai
app.use("/files", fileRoutes);

// orgs (workspaces) — token sab par; /orgs/:orgId ke neeche role ka check routes mein requireRole se
app.use("/orgs", authMiddleware, orgRoutes);

// email ke invite link — GET sirf API key (login se pehle bhi), accept par token route ke andar
app.use("/invitations", invitationRoutes);

// koi route match nahi hua
app.use(notFoundMiddleware);

// error handler hamesha sabse aakhir mein
app.use(errorHandler);

module.exports = app;