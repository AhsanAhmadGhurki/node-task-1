// tests ka shared setup — har test file apna alag DB ("<MONGO_URI wala naam>_<file>_test")
// node --test files ko parallel chalata hai — ek DB hota to ek file doosri ka data mita deti
// email stub — asli email nahi jaati; rate limiters bhi stub (tests limit se nahi takrate),
// sirf { realLimiters: true } wali file mein asli
const path = require("node:path");
const assert = require("node:assert/strict");

// upload tests ke liye har type ke asli shuru ke bytes (magic bytes) — server file-type se inhi ko pehchanta hai
// PNG mein IHDR ke baad IDAT ka header bhi, taake file-type foran "png" bata de (APNG ki talaash mein poori file na padhe)
const SIGNATURES = {
  "image/jpeg": Buffer.from("ffd8ffe000104a46494600", "hex"),
  "image/png": Buffer.concat([
    Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"),
    Buffer.alloc(13 + 4),
    Buffer.from("0000000049444154", "hex")
  ]),
  "image/webp": Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]),
  "application/pdf": Buffer.from("%PDF-1.4\n")
};

// file ke bytes — content diya ho to wahi, warna declared type ka signature, phir 0x01 se `bytes` tak bharo
// (size wahi rehta hai, is liye 2 MB wale tests ki had nahi badalti); signature na ho (html, svg) to sirf 0x01
function fileBytes(type, bytes, content) {
  if (content) {
    return content;
  }
  const signature = SIGNATURES[type] || Buffer.alloc(0);
  return Buffer.concat([signature, Buffer.alloc(bytes - signature.length, 1)]);
}

function setupTestApp(name, { realLimiters = false } = {}) {
  // config require hone se PEHLE test DB — warna asli DB par users bante/mitte
  const mongoUrl = new URL(process.env.MONGO_URI);
  mongoUrl.pathname = `/${mongoUrl.pathname.replace(/^\//, "") || "tasksdb"}_${name}_test`;
  process.env.MONGO_URI = mongoUrl.toString();
  const testDb = mongoUrl.pathname.slice(1);

  const SRC = path.join(__dirname, "..", "src");

  if (!realLimiters) {
    const passThrough = (req, res, next) => next();
    require.cache[require.resolve(path.join(SRC, "middleware", "rateLimit"))] = {
      id: "rateLimit-stub",
      loaded: true,
      exports: {
        resendLimiter: passThrough,
        resendEmailCooldown: passThrough,
        registerLimiter: passThrough,
        loginLimiter: passThrough,
        otpVerifyLimiter: passThrough
      }
    };
  }

  // email stub — code yahan pakadte hain (asli inbox ki jagah)
  const emailService = require(path.join(SRC, "services", "emailService"));
  const sentEmails = [];
  emailService.sendOtpEmail = (email, otp, purpose) => sentEmails.push({ email, otp, purpose });

  // app ke console.log (har request ka log) test output mein na aaye
  console.log = () => {};

  const mongoose = require("mongoose");
  const app = require(path.join(SRC, "app"));
  const config = require(path.join(SRC, "config"));

  const ctx = { mongoose, config, sentEmails, baseUrl: null, server: null };

  ctx.codesFor = (email) => sentEmails.filter((m) => m.email === email).map((m) => m.otp);

  ctx.request = async (method, route, { body, token, apiKey = config.apiKey } = {}) => {
    const headers = {};
    if (apiKey !== null) {
      headers["x-api-key"] = apiKey;
    }
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const res = await fetch(ctx.baseUrl + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json, text, cookie: res.headers.get("set-cookie") };
  };
  ctx.post = (route, body) => ctx.request("POST", route, { body });

  ctx.start = async () => {
    // galti se asli DB na mite — naam "_test" par khatam hona hi chahiye
    assert.match(testDb, /_test$/);
    await mongoose.connect(config.mongoUri);
    await mongoose.connection.db.dropDatabase();
    // createIndexes, init() nahi — init() ka promise cache hota hai: connect par chala auto-index drop se PEHLE
    // poora ho jaye to drop use mita deta aur init() dobara nahi banata (unique email index ke baghair tests chalte)
    await Promise.all(["User", "Otp", "RefreshToken", "Task", "Ticket"].map((model) => mongoose.model(model).createIndexes()));
    ctx.server = app.listen(0);
    await new Promise((resolve) => ctx.server.once("listening", resolve));
    ctx.baseUrl = `http://127.0.0.1:${ctx.server.address().port}`;
  };

  ctx.stop = async () => {
    ctx.server.close();
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  };

  // register + inbox wala code se verify — verified account aur uska token
  ctx.verifiedAccount = async (email, password = "Valid1234!") => {
    await ctx.post("/auth/register", { email, password });
    const otp = ctx.codesFor(email).at(-1);
    return ctx.post("/auth/verify-email", { email, otp, password });
  };

  return ctx;
}

module.exports = { setupTestApp, SIGNATURES, fileBytes };
