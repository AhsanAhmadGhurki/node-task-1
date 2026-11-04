// login 2FA — POST /auth/login/request-otp (password → email par code) aur /auth/login/verify-otp (code → tokens)
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js); IP limiters stub, DB ki 3/ghanta had asli
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("loginotp");
const { post, sentEmails } = ctx;
const PASSWORD = "Valid1234!";

const requestOtp = (email, password = PASSWORD) => post("/auth/login/request-otp", { email, password });
const verifyOtp = (email, otp) => post("/auth/login/verify-otp", { email, otp });
const loginCodes = (email) => sentEmails.filter((m) => m.email === email && m.purpose === "login").map((m) => m.otp);

before(() => ctx.start());
after(() => ctx.stop());

test("sahi password → code email par (purpose login), token nahi; code se token + cookie; code ek hi dafa", async () => {
  await ctx.verifiedAccount("otp-ok@example.com");

  const res = await requestOtp("OTP-OK@example.com ");
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { message: "A login code has been sent to your email.", expiresInSeconds: 300 });
  assert.equal(res.cookie, null);
  const [otp] = loginCodes("otp-ok@example.com");
  assert.match(otp, /^\d{6}$/);

  const ok = await verifyOtp("otp-ok@example.com", otp);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.message, "Logged in");
  assert.ok(ok.json.token);
  assert.equal(ok.json.user.email, "otp-ok@example.com");
  assert.equal(ok.json.user.password, undefined);
  assert.match(ok.cookie, /refreshToken=.*HttpOnly/i);

  // token protected route par chalta hai
  assert.equal((await ctx.request("GET", "/tasks", { token: ok.json.token })).status, 200);

  // dobara wahi code — istemal ho chuka
  const again = await verifyOtp("otp-ok@example.com", otp);
  assert.equal(again.status, 400);
  assert.equal(again.json.message, "Invalid or expired code");
});

test("request-otp: ghalat password 401, unverified 403, validation 400 — kisi par code nahi jaata", async () => {
  await ctx.verifiedAccount("otp-err@example.com");
  await post("/auth/register", { email: "otp-unverified@example.com", password: PASSWORD });
  const before = sentEmails.length;

  assert.equal((await requestOtp("otp-err@example.com", "Wrong1234")).status, 401);
  assert.equal((await requestOtp("nobody@example.com")).status, 401);
  assert.equal((await requestOtp("otp-unverified@example.com")).status, 403);
  const bad = await post("/auth/login/request-otp", { email: "not-an-email" });
  assert.equal(bad.status, 400);
  assert.ok(Array.isArray(bad.json.errors));

  assert.equal(sentEmails.length, before);
});

test("verify-otp: ghalat code / anjaan email / galat shakal — 400; 5 ghalat par code band", async () => {
  await ctx.verifiedAccount("otp-guess@example.com");
  await requestOtp("otp-guess@example.com");
  const [otp] = loginCodes("otp-guess@example.com");
  const wrong = otp === "000000" ? "111111" : "000000";

  assert.equal((await verifyOtp("nobody@example.com", otp)).status, 400);
  assert.equal((await verifyOtp("otp-guess@example.com", "12ab")).json.message, "Code must be 6 digits");

  for (let i = 0; i < 5; i++) {
    assert.equal((await verifyOtp("otp-guess@example.com", wrong)).status, 400);
  }
  // 5 ghalat ke baad sahi code bhi nahi
  assert.equal((await verifyOtp("otp-guess@example.com", otp)).status, 400);
});

test("ghante mein 3 login codes — 4th par 429 { message, retryAfter, resetAt } + Retry-After; verify-email ki ginti alag", async () => {
  await ctx.verifiedAccount("otp-limit@example.com");
  for (let i = 0; i < 3; i++) {
    assert.equal((await requestOtp("otp-limit@example.com")).status, 200);
  }

  const res = await fetch(`${ctx.baseUrl}/auth/login/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ctx.config.apiKey },
    body: JSON.stringify({ email: "otp-limit@example.com", password: PASSWORD })
  });
  const body = await res.json();
  assert.equal(res.status, 429);
  assert.match(body.message, /^Too many codes requested\. Please try again in \d+ minutes?\.$/);
  assert.ok(body.retryAfter > 3500 && body.retryAfter <= 3600, `retryAfter=${body.retryAfter}`);
  assert.equal(Number(res.headers.get("retry-after")), body.retryAfter);
  assert.ok(Math.abs(Date.parse(body.resetAt) - (Date.now() + body.retryAfter * 1000)) < 2000);
  assert.equal(loginCodes("otp-limit@example.com").length, 3);

  // aakhri code abhi bhi chalta hai
  assert.equal((await verifyOtp("otp-limit@example.com", loginCodes("otp-limit@example.com").at(-1))).status, 200);
});
