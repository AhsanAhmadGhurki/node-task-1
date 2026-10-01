// 409 — resource pehle se maujood hai (jaise same email dobara register)
class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 409;
  }
}

module.exports = ConflictError;
