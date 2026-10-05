// Tasks REST API — entry point: pehle .env check, phir database, phir server
const validateEnv = require("./config/validateEnv");
const app = require("./app");
const config = require("./config");
const connectDB = require("./config/db");

async function startServer() {
  // .env mein kuch missing/galat ho to yahin ruk jao — DB connect ya server start karne ka faida nahi
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("Server start nahi hua — backend/.env theek karein:");
    envErrors.forEach((message) => console.error(`  - ${message}`));
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // DB ke baghair API bekaar hai — process band kar do
    process.exit(1);
  }

  // DB aur server ke errors alag — pehle ek hi try mein the, to port ki galti bhi "MongoDB connection failed" dikhti thi
  try {
    app.listen(config.port, (error) => {
      // port pehle se busy ho to error yahan (callback mein) aata hai
      if (error) {
        console.error("Server start nahi hua:", error.message);
        process.exit(1);
      }
      console.log(`Tasks API is running: http://localhost:${config.port}/tasks`);
    });
  } catch (error) {
    // galat port (jaise range se bahar) par listen foran throw karta hai — callback tak nahi pahunchta
    console.error("Server start nahi hua:", error.message);
    process.exit(1);
  }
}

startServer();
