// 429 — bahut jaldi jaldi request (jaise 60 second ke andar dobara verification email)
class TooManyRequestsError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 429;
  }
}

module.exports = TooManyRequestsError;
