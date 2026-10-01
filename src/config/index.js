// saari settings ek jagah — process.env sirf yahin padhte hain
module.exports = {
  port: process.env.PORT || 4000,
  // connection string .env se — password code mein nahi likhte
  mongoUri: process.env.MONGO_URI,
  apiKey: process.env.API_KEY
};
