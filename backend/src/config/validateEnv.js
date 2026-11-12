// server start hone se pehle .env check — kuch missing ho to foran saaf error, baad mein ajeeb 500 nahi
// (warna JWT_SECRET na ho to server chal jaata, aur har login par 500 aata)

// inke baghair app chal hi nahi sakti
const REQUIRED = ["MONGO_URI", "API_KEY", "JWT_SECRET"];

// JWT secret chhota ho to brute force se token jaali banaye ja sakte hain
const MIN_JWT_SECRET_LENGTH = 32;

// API key bhi andaza lagane layak na ho — "openssl rand -hex 32" 64 characters deta hai
const MIN_API_KEY_LENGTH = 32;

// port 1–65535 — 0 par OS koi bhi random port de deta hai, 65535 se upar listen/SMTP fail hota hai
// sirf digits — "abc" ya "3000x" ko Number() chupke se NaN/default bana deta
function portError(name, value) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    return `${name} must be a number between 1 and 65535`;
  }

  return null;
}

// saari galtiyan ek saath lautao — ek ek karke theek karne ki zaroorat na pade
function validateEnv(env = process.env) {
  const errors = [];

  for (const name of REQUIRED) {
    if (!env[name] || env[name].trim() === "") {
      errors.push(`${name} is missing`);
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }

  if (env.API_KEY && env.API_KEY.trim() !== "" && env.API_KEY.length < MIN_API_KEY_LENGTH) {
    errors.push(`API_KEY must be at least ${MIN_API_KEY_LENGTH} characters`);
  }

  // galat shakal ka URI DB connect ki koshish se pehle hi pakdo — warna driver ka error baad mein aata
  if (env.MONGO_URI && env.MONGO_URI.trim() !== "" && !/^mongodb(\+srv)?:\/\//.test(env.MONGO_URI.trim())) {
    errors.push("MONGO_URI must start with mongodb:// or mongodb+srv://");
  }

  // SMTP optional hai — lekin aadha (sirf user ya sirf pass) ho to email chupke se fail hoti
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
    errors.push("SMTP_USER and SMTP_PASS must be set together (or both left empty)");
  }

  // production mein SMTP zaroori — SMTP na ho to verification code console (logs) mein chhapta hai,
  // aur logs parhne wala kisi ka bhi email verify kar sakta; development mein yahi console wala rasta theek hai
  if (env.NODE_ENV === "production" && (!env.SMTP_USER || !env.SMTP_PASS)) {
    errors.push("SMTP_USER and SMTP_PASS are required when NODE_ENV=production (otherwise codes are printed to the logs)");
  }

  // EXPOSE_DEV_OTP code ko API response mein daal deta hai — production mein on ho to koi bhi kisi ka account verify/login kar le
  if (env.EXPOSE_DEV_OTP && env.EXPOSE_DEV_OTP !== "true" && env.EXPOSE_DEV_OTP !== "false") {
    errors.push("EXPOSE_DEV_OTP must be true or false");
  }
  if (env.NODE_ENV === "production" && env.EXPOSE_DEV_OTP === "true") {
    errors.push("EXPOSE_DEV_OTP must not be true when NODE_ENV=production (it returns login codes in API responses)");
  }

  // dono optional — na hon to default (3000 / 465), lekin di gayi value galat ho to chupke se default nahi
  for (const name of ["PORT", "SMTP_PORT"]) {
    if (env[name]) {
      const portProblem = portError(name, env[name]);
      if (portProblem) {
        errors.push(portProblem);
      }
    }
  }

  // APP_URL (refresh cookie ka Secure) aur FRONTEND_URL (invite email ka link) — galat ho to har link toota hua jaata
  for (const name of ["APP_URL", "FRONTEND_URL"]) {
    if (!env[name]) continue;
    try {
      const { protocol } = new URL(env[name]);
      if (protocol !== "http:" && protocol !== "https:") {
        errors.push(`${name} must start with http:// or https://`);
      }
    } catch {
      errors.push(`${name} is not a valid URL`);
    }
  }

  return errors;
}

module.exports = validateEnv;
