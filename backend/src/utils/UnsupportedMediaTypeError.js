// 415 — upload ki gayi file ka type support nahi hota (avatar sirf JPEG, PNG ya WebP)
class UnsupportedMediaTypeError extends Error {
  constructor(message = "Avatar must be a valid JPEG, PNG or WebP image.") {
    super(message);
    this.statusCode = 415;
    this.name = "UnsupportedMediaTypeError";
  }
}

module.exports = UnsupportedMediaTypeError;
