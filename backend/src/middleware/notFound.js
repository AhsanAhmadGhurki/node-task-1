// koi route match nahi hua — saare routes ke baad lagta hai
function notFoundMiddleware(req, res) {
  res.status(404).json({ message: "Route not found" });
}

module.exports = notFoundMiddleware;
