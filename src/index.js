// Tasks REST API — entry point: pehle database, phir server
const app = require("./app");
const config = require("./config");
const connectDB = require("./config/db");

async function startServer() {
  try {
    await connectDB();

    app.listen(config.port, (error) => {
      // port pehle se busy ho to error yahan aata hai
      if (error) {
        console.error("Server start nahi hua:", error.message);
        process.exit(1);
      }
      console.log(`Tasks API is running: http://localhost:${config.port}/tasks`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // DB ke baghair API bekaar hai — process band kar do
    process.exit(1);
  }
}

startServer();
