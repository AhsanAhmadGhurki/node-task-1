// signed URLs — /files/:fileId?expires=<unix sec>&sig=<HMAC>, bina token ke 10 minute chalne wala link
//
// ye pattern kyun hai: <img src>, <a href> aur <video src> browser khud bhejta hai — un mein hum
// "Authorization: Bearer ..." header nahi laga sakte. raaste do the:
//   1. JS se file blob mein laao (axios + token), phir blob: URL — poori file JS memory mein, caching nahi,
//      aur bade download pehle poore browser ki memory mein aate hain, phir "save" hote hain
//   2. server ek chhota, sirf-is-file-ka, jaldi expire hone wala link de — wahi link <img src> mein seedha
//      (browser khud stream karta hai, download seedha disk par). S3/CloudFront ke "presigned URL" yahi hain
// link mein token nahi hota — sirf fileId + expiry + un par server ka HMAC. koi fileId ya expiry badle to sig
// match nahi karta, aur secret ke bina naya sig ban nahi sakta. lekin jiske paas link hai, 10 minute tak
// woh file dekh sakta hai (bearer link) — is liye chhoti umar, aur logger sig chhupata hai
const crypto = require("crypto");
const config = require("../config");

// JWT_SECRET seedha nahi — us se ek alag key nikalte hain, taake file-link ka sig kabhi JWT ki jagah na chal sake
// (aur JWT ka sig file-link ki jagah). lazy: index.js app ko validateEnv se pehle require karta hai
let key;
function signingKey() {
  if (!key) {
    key = crypto.createHmac("sha256", config.jwtSecret).update("signed-file-urls:v1").digest();
  }
  return key;
}

// fileId + expiry ka HMAC — base64url, URL mein bina escape ke chalta hai
function signature(fileId, expires) {
  return crypto.createHmac("sha256", signingKey()).update(`${fileId}:${expires}`).digest("base64url");
}

// naya link banao — expires unix seconds mein (URL chhota, aur Date ki tarah parse ka jhagra nahi)
function createSignedPath(fileId, ttlSeconds = config.signedUrlTtlSeconds) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return {
    path: `/files/${fileId}?expires=${expires}&sig=${signature(fileId, expires)}`,
    expiresAt: new Date(expires * 1000)
  };
}

// link sahi hai aur abhi expire nahi hua? — sirf true/false, wajah bahar nahi batate
function verifySignedPath(fileId, expires, sig) {
  // query mein string hi aani chahiye — "?sig=a&sig=b" array deta hai
  if (typeof expires !== "string" || typeof sig !== "string" || !/^\d{1,12}$/.test(expires)) {
    return false;
  }

  if (Number(expires) < Math.floor(Date.now() / 1000)) {
    return false;
  }

  // timingSafeEqual — "!==" pehle ghalat character par ruk jaata hai, us waqt ke farq se sig andaze se banaya ja sakta
  // (lambai alag ho to timingSafeEqual throw karta hai — is liye pehle lambai)
  const expected = Buffer.from(signature(fileId, expires));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

module.exports = { createSignedPath, verifySignedPath };
