// har request ka METHOD + URL + TIMESTAMP print karo
function loggingMiddleware(req, res, next) {
  // toISOString() → 2026-09-28T19:40:12.123Z
  const timestamp = new Date().toISOString();

  // codes/passwords body mein jaate hain — body kabhi log nahi hoti
  // sirf signed file link ka "sig" URL mein hota hai — wo bina token file kholta hai, log padhne wala na utha le
  const url = req.url.replace(/([?&]sig=)[^&]*/g, "$1[redacted]");
  console.log(`${req.method} ${url} ${timestamp}`);

  // aage wale route/middleware ko chalne do — ye na ho to request atak jayegi
  next();
}

module.exports = loggingMiddleware;
