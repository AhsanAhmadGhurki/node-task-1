// saari settings ek jagah — process.env sirf yahin padhte hain
module.exports = {
  port: process.env.PORT || 4000,
  // connection string .env se — password code mein nahi likhte
  mongoUri: process.env.MONGO_URI,
  apiKey: process.env.API_KEY,
  // JWT sign/verify karne ki secret key — .env se, code mein kabhi nahi
  jwtSecret: process.env.JWT_SECRET
};
