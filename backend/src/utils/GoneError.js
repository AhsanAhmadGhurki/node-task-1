// 410 — cheez thi, lekin ab nahi chalti (jaise expire hua invite link)
class GoneError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 410;
  }
}

module.exports = GoneError;
