// login 2FA — POST /auth/login/request-otp (password → email par code + loginToken) aur /auth/login/verify-otp (loginToken + code → tokens)
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js); IP limiters stub, DB ki 10/ghanta had asli
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("loginotp");
const { post, sentEmails } = ctx;
const PASSWORD = "Valid1234!";

const requestOtp = (email, password = PASSWORD) => post("/auth/login/request-otp", { email, password });
const verifyOtp = (loginToken, otp) => post("/auth/login/verify-otp", { loginToken, otp });
const loginCodes = (email) => sentEmails.filter((m) => m.email === email && m.purpose === "login").map((m) => m.otp);
const otherCode = (otp) => (otp === "000000" ? "111111" : "000000");

before(() => ctx.start());
after(() => ctx.stop());

test("sahi password → code email par + loginToken, access token nahi; loginToken + code se token + cookie; ek hi dafa", async () => {
  await ctx.verifiedAccount("otp-ok@example.com");

  const res = await requestOtp("OTP-OK@example.com ");
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "A login code has been sent to your email.");
  assert.equal(res.json.expiresInSeconds, 300);
  assert.match(res.json.loginToken, /^[a-f0-9]{64}$/);
  assert.equal(res.json.token, undefined);
  assert.equal(res.cookie, null);
  const [otp] = loginCodes("otp-ok@example.com");

  // DB mein loginToken asal shakal mein nahi — sirf hash
  const doc = await ctx.mongoose.model("Otp").findOne({ purpose: "login" }).lean();
  assert.notEqual(doc.challengeHash, res.json.loginToken);

  const ok = await verifyOtp(res.json.loginToken, otp);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.message, "Logged in");
  assert.equal(ok.json.user.email, "otp-ok@example.com");
  assert.equal(ok.json.user.password, undefined);
  assert.match(ok.cookie, /refreshToken=.*HttpOnly/i);
  assert.equal((await ctx.request("GET", "/tasks", { token: ok.json.token })).status, 200);

  const again = await verifyOtp(res.json.loginToken, otp);
  assert.equal(again.status, 400);
  assert.equal(again.json.message, "Invalid or expired code");
});

test("purana password-only POST /auth/login band — 410, na token na cookie", async () => {
  await ctx.verifiedAccount("otp-old@example.com");
  const res = await post("/auth/login", { email: "otp-old@example.com", password: PASSWORD });
  assert.equal(res.status, 410);
  assert.match(res.json.message, /request-otp/);
  assert.equal(res.json.token, undefined);
  assert.equal(res.cookie, null);
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

test("bina loginToken (sirf email jaanne wala) code nahi jala sakta — asli malik phir bhi login karta hai", async () => {
  await ctx.verifiedAccount("otp-victim@example.com");
  const { json } = await requestOtp("otp-victim@example.com");
  const [otp] = loginCodes("otp-victim@example.com");

  // attacker: apna banaya / purana / ghalat token — 20 koshishen
  const fake = "a".repeat(64);
  for (let i = 0; i < 20; i++) {
    assert.equal((await verifyOtp(fake, otherCode(otp))).status, 400);
  }
  // purana email+otp wala body ab validation par hi ruk jaata hai
  const old = await post("/auth/login/verify-otp", { email: "otp-victim@example.com", otp });
  assert.equal(old.status, 400);
  assert.equal(old.json.message, "Login token is required");

  assert.equal((await verifyOtp(json.loginToken, otp)).status, 200);
});

test("verify-otp: 5 ghalat par code band; naya request-otp purana loginToken band kar deta hai", async () => {
  await ctx.verifiedAccount("otp-guess@example.com");
  const first = (await requestOtp("otp-guess@example.com")).json.loginToken;
  const [otp] = loginCodes("otp-guess@example.com");

  assert.equal((await verifyOtp(first, "12ab")).json.message, "Code must be 6 digits");
  for (let i = 0; i < 5; i++) {
    assert.equal((await verifyOtp(first, otherCode(otp))).status, 400);
  }
  assert.equal((await verifyOtp(first, otp)).status, 400);

  // naya code — purana token us par nahi chalta, naya chalta hai
  const second = (await requestOtp("otp-guess@example.com")).json.loginToken;
  const newOtp = loginCodes("otp-guess@example.com").at(-1);
  assert.equal((await verifyOtp(first, newOtp)).status, 400);
  assert.equal((await verifyOtp(second, newOtp)).status, 200);
});

test("ghante mein 10 login codes (4 logins aaraam se) — 11th par 429 { message, retryAfter, resetAt } + Retry-After", async () => {
  await ctx.verifiedAccount("otp-limit@example.com");
  for (let i = 0; i < 10; i++) {
    const res = await requestOtp("otp-limit@example.com");
    assert.equal(res.status, 200, `code ${i + 1}`);
    // pehle 4 — poora login (purani 3 ki had par 4th yahin 429 deta)
    if (i < 4) {
      assert.equal((await verifyOtp(res.json.loginToken, loginCodes("otp-limit@example.com").at(-1))).status, 200);
    }
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
  assert.equal(body.loginToken, undefined);
  assert.equal(loginCodes("otp-limit@example.com").length, 10);
});
