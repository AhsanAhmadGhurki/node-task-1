// 403 — pehchaan sahi hai lekin ijazat nahi (jaise email verify nahi hua)
class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 403;
  }
}

module.exports = ForbiddenError;
