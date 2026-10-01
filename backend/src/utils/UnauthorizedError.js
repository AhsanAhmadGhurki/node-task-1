// 401 — pehchaan sabit nahi hui (jaise galat email ya password)
class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
}

module.exports = UnauthorizedError;
