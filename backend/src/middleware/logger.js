// har request ka METHOD + URL + TIMESTAMP print karo
function loggingMiddleware(req, res, next) {
  // toISOString() → 2026-09-28T19:40:12.123Z
  const timestamp = new Date().toISOString();

  // /verify/<token> mein asal token hota hai — log mein chhupa do, warna logs se link ban sakta hai
  // /verify/resend (form ka route) token nahi hai — use waise hi dikhao
  const url = req.url.replace(/^\/verify\/(?!resend(?:[/?#]|$))[^/?#]+/, "/verify/<token>");

  console.log(`${req.method} ${url} ${timestamp}`);

  // aage wale route/middleware ko chalne do — ye na ho to request atak jayegi
  next();
}

module.exports = loggingMiddleware;
