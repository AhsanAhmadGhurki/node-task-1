// saari settings ek jagah — process.env sirf yahin padhte hain
const port = process.env.PORT || 3000;

module.exports = {
  port,
  // backend ka public address — https ho to refresh cookie "Secure" lagti hai
  // production mein sirf .env mein badlo (jaise https://api.example.com); aakhri "/" hata do
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
  // connection string .env se — password code mein nahi likhte
  mongoUri: process.env.MONGO_URI,
  apiKey: process.env.API_KEY,
  // JWT sign/verify karne ki secret key — .env se, code mein kabhi nahi
  jwtSecret: process.env.JWT_SECRET,
  // email code kitni der chalta hai — authService (DB expiry) aur email ka text dono yahin se,
  // taake badalne par email galat waqt na bataye
  otpTtlMs: 5 * 60 * 1000,
  // email bhejne ki settings — default Gmail; user/pass na hon to email nahi jaati, sirf console
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    // validateEnv pehle hi 1–65535 check kar chuka — yahan sirf "na di ho to 465"
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
    // Gmail address
    user: process.env.SMTP_USER,
    // Gmail ka asal password nahi — Google ka 16-character "App Password"
    // Google ise "abcd efgh ijkl mnop" ki shakal mein dikhata hai — copy mein spaces aa jayein to hata do
    pass: process.env.SMTP_PASS && process.env.SMTP_PASS.replace(/\s/g, "")
  }
};
