// OpenAPI spec — swagger-jsdoc routes/*.js ke "@openapi" comments padh kar ek object banata hai
// docs code ke saath (route ke theek upar) — route badle to docs bhi saamne; alag file hoti to purani ho jaati (README jaisi)
// yahan sirf info aur security schemes; reusable schemas components.yaml mein, har endpoint apne route ke upar
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const definition = {
  openapi: "3.0.3",
  info: {
    title: "TaskDesk API",
    version: "1.0.0",
    description: [
      "Tasks, support tickets, profile aur files ka REST API.",
      "",
      "**Shuru kaise karein:**",
      "1. **Authorize** dabayen aur `ApiKeyAuth` mein `x-api-key` daalein (har request par lagti hai).",
      "2. `POST /auth/login/request-otp` (email + password) chalayen. Email par code aata hai, jawab mein `loginToken`.",
      "3. `POST /auth/login/verify-otp` (`loginToken` + code) chalayen. Jawab ka `token` copy karein.",
      "4. **Authorize** mein `BearerAuth` par wo token daalein (sirf token, `Bearer` khud lagta hai).",
      "5. Ab taale (🔒) wale routes \"Try it out\" se chal jayenge."
    ].join("\n")
  },
  // relative — jis server se /api-docs khula, requests bhi wahin jaati hain (localhost ho ya deploy)
  servers: [{ url: "/", description: "Yahi server" }],
  components: {
    securitySchemes: {
      // har request par — app.js ka apiKeyMiddleware
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Har request par zaroori. Ghalat ya na ho to 401 `Invalid or missing API key`."
      },
      // logged-in routes — access token POST /auth/login/verify-otp se (15 minute chalta hai)
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "`POST /auth/login/verify-otp` ka `token`. 15 minute chalta hai."
      }
    }
  },
  // default: sirf API key — jin routes ko token chahiye wo apne comment mein `security` khud likhte hain
  security: [{ ApiKeyAuth: [] }]
};

// spec ek dafa startup par — har /api-docs request par comments dobara parse karna bekaar
const openapiSpec = swaggerJsdoc({
  definition,
  // routes ke @openapi comments + components.yaml (reusable schemas/responses — "$ref" se)
  apis: [path.join(__dirname, "..", "routes", "*.js"), path.join(__dirname, "components.yaml")]
});

module.exports = openapiSpec;
