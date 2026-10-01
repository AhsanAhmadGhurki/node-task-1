// 410 — resource pehle tha lekin ab nahi raha (jaise expire ya istemal ho chuka verification link)
class GoneError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 410;
  }
}

module.exports = GoneError;
