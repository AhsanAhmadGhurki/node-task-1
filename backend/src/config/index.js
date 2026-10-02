// saari settings ek jagah — process.env sirf yahin padhte hain
const port = process.env.PORT || 3000;

module.exports = {
  port,
  // backend ka public address — email ke links isi se bante hain
  // production mein sirf .env mein badlo (jaise https://api.example.com); aakhri "/" hata do taake "//verify" na bane
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
  // connection string .env se — password code mein nahi likhte
  mongoUri: process.env.MONGO_URI,
  apiKey: process.env.API_KEY,
  // JWT sign/verify karne ki secret key — .env se, code mein kabhi nahi
  jwtSecret: process.env.JWT_SECRET,
  // email bhejne ki settings — default Gmail; user/pass na hon to email nahi jaati, sirf console
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    // Gmail address
    user: process.env.SMTP_USER,
    // Gmail ka asal password nahi — Google ka 16-character "App Password"
    // Google ise "abcd efgh ijkl mnop" ki shakal mein dikhata hai — copy mein spaces aa jayein to hata do
    pass: process.env.SMTP_PASS && process.env.SMTP_PASS.replace(/\s/g, "")
  }
};
