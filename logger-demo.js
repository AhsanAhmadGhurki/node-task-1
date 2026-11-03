const username = "raheel";

console.log("Application is starting");
console.log("Login request received");

if (username) {
  console.info("Username is available");
} else {
  console.error("Username is missing");
}

console.warn("This is a test warning");
console.error("This is a test error");

console.log("Login request processing finished");
