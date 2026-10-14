// 413 — upload had se badi (ticket ki ek file 2 MB se badi, ya sab files mila kar 5 MB se zyada)
class PayloadTooLargeError extends Error {
  constructor(message = "Payload too large.") {
    super(message);
    this.name = "PayloadTooLargeError";
    this.statusCode = 413;
  }
}

module.exports = PayloadTooLargeError;
