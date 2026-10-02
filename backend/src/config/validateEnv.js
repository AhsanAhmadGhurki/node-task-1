// server start hone se pehle .env check — kuch missing ho to foran saaf error, baad mein ajeeb 500 nahi
// (warna JWT_SECRET na ho to server chal jaata, aur har login par 500 aata)

// inke baghair app chal hi nahi sakti
const REQUIRED = ["MONGO_URI", "API_KEY", "JWT_SECRET"];

// JWT secret chhota ho to brute force se token jaali banaye ja sakte hain
const MIN_JWT_SECRET_LENGTH = 32;

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

  // SMTP optional hai — lekin aadha (sirf user ya sirf pass) ho to email chupke se fail hoti
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) {
    errors.push("SMTP_USER and SMTP_PASS must be set together (or both left empty)");
  }

  if (env.PORT && !/^\d+$/.test(env.PORT)) {
    errors.push("PORT must be a number");
  }

  // email ke links isi se bante hain — galat ho to har link toota hua jaata
  if (env.APP_URL) {
    try {
      const { protocol } = new URL(env.APP_URL);
      if (protocol !== "http:" && protocol !== "https:") {
        errors.push("APP_URL must start with http:// or https://");
      }
    } catch {
      errors.push("APP_URL is not a valid URL");
    }
  }

  return errors;
}

module.exports = validateEnv;
