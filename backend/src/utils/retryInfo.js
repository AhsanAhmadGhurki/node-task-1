// 429/423 ki body mein bacha hua waqt — har limiter aur errorHandler ek hi shakal bhejein
// retryAfter: kitne second baad (Retry-After header ke barabar), resetAt: kab khulega (ISO time)
// kam se kam 1 second — "0 second baad" kehna aur phir dobara 429 dena ghalat lagta
function retryInfo(resetTime) {
  const retryAfter = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  return { retryAfter, resetAt: new Date(Date.now() + retryAfter * 1000).toISOString() };
}

// seconds se — LockedError / TooManyRequestsError sirf seconds rakhte hain
function retryInfoFromSeconds(seconds) {
  return retryInfo(new Date(Date.now() + seconds * 1000));
}

module.exports = { retryInfo, retryInfoFromSeconds };
