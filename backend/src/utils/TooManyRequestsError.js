// 429 — bahut jaldi jaldi request (jaise ghante mein 3 se zyada codes)
// retryAfterSeconds ho to errorHandler Retry-After header aur body mein retryAfter/resetAt lagata hai
class TooManyRequestsError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.statusCode = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

module.exports = TooManyRequestsError;
