// har request ka METHOD + URL + TIMESTAMP print karo
function loggingMiddleware(req, res, next) {
  // toISOString() → 2026-09-28T19:40:12.123Z
  const timestamp = new Date().toISOString();

  console.log(`${req.method} ${req.url} ${timestamp}`);

  // aage wale route/middleware ko chalne do — ye na ho to request atak jayegi
  next();
}

module.exports = loggingMiddleware;
