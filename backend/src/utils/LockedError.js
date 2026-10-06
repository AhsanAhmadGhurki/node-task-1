// 423 — account kuch der ke liye band (lagataar galat password); retryAfterSeconds se Retry-After header
class LockedError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.statusCode = 423;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

module.exports = LockedError;
