const mongoose = require("mongoose");
const config = require("./index");

// MongoDB se connect karo — fail ho to error upar (index.js) tak jayega
async function connectDB() {
  await mongoose.connect(config.mongoUri);

  console.log("MongoDB connected");
}

module.exports = connectDB;
