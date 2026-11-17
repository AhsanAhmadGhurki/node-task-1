// password bhool gaye (forgot/reset) aur password badalna (change) — enumeration, code ke qaide, sab devices logout
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("password");

const OLD = "Valid1234!";
const NEW = "Fresh5678#";
const GENERIC = "If an account exists for this email, a password reset code has been sent.";

const forgot = (email) => ctx.post("/auth/forgot-password", { email });
const reset = (email, otp, password = NEW) => ctx.post("/auth/reset-password", { email, otp, password });
const resetCodes = (email) => ctx.sentEmails.filter((m) => m.email === email && m.purpose === "reset-password").map((m) => m.otp);

// password badalne se PEHLE bana token — iat purana (passwordChangedAt second tak hota hai, isi second ka token bach jaata)
const oldToken = (userId) =>
  jwt.sign({ sub: userId, iat: Math.floor(Date.now() / 1000) - 10 }, ctx.config.jwtSecret, { algorithm: "HS256", expiresIn: "15m" });

// refresh cookie ke saath /auth/refresh (ctx.request cookie nahi bhejta)
const refreshWith = async (setCookie) => {
  const cookie = setCookie.split(";")[0];
  const res = await fetch(`${ctx.baseUrl}/auth/refresh`, { method: "POST", headers: { "x-api-key": ctx.config.apiKey, cookie } });
  return res.status;
};

before(() => ctx.start());
after(() => ctx.stop());

// ---------- forgot-password ----------

test("forgot: har halat mein wahi 200 — code sirf verified account ko", async () => {
  await ctx.verifiedAccount("verified-pw@example.test", OLD);
  await ctx.post("/auth/register", { email: "unverified-pw@example.test", password: OLD });

  for (const email of ["verified-pw@example.test", "unverified-pw@example.test", "nobody-pw@example.test", "  VERIFIED-pw@Example.test "]) {
    const res = await forgot(email);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { message: GENERIC });
  }
  assert.equal(resetCodes("verified-pw@example.test").length, 2, "normalize ke baad dono verified wale ko");
  assert.equal(resetCodes("unverified-pw@example.test").length, 0);
  assert.equal(resetCodes("nobody-pw@example.test").length, 0);
});

test("forgot: ghanta mein 3 codes — 4th par bhi wahi 200, email nahi (429 account ka pata deta)", async () => {
  await ctx.verifiedAccount("limit-pw@example.test", OLD);
  for (let i = 0; i < 4; i++) {
    const res = await forgot("limit-pw@example.test");
    assert.equal(res.status, 200);
    assert.equal(res.json.message, GENERIC);
  }
  assert.equal(resetCodes("limit-pw@example.test").length, 3);
});

test("forgot: ghalat email ki shakal — 400", async () => {
  const res = await forgot("not-an-email");
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "Please enter a valid email address");
});

// ---------- reset-password ----------

test("reset: sahi code se naya password — purana nahi chalta, naya chalta hai; login nahi karwata", async () => {
  await ctx.verifiedAccount("reset-ok@example.test", OLD);
  await forgot("reset-ok@example.test");

  const res = await reset("reset-ok@example.test", resetCodes("reset-ok@example.test").at(-1));
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "Your password has been changed. Please log in with your new password.");
  assert.equal(res.json.token, undefined);
  assert.equal(res.cookie, null);

  assert.equal((await ctx.login({ email: "reset-ok@example.test", password: OLD })).status, 401);
  assert.equal((await ctx.login({ email: "reset-ok@example.test", password: NEW })).status, 200);
});

test("reset: har galti ka ek hi 400 — ghalat code, account nahi, unverified; code ek hi dafa", async () => {
  await ctx.verifiedAccount("reset-bad@example.test", OLD);
  await forgot("reset-bad@example.test");
  const code = resetCodes("reset-bad@example.test").at(-1);
  const wrong = code === "000000" ? "111111" : "000000";

  for (const res of [
    await reset("reset-bad@example.test", wrong),
    await reset("nobody-reset@example.test", code),
    await reset("unverified-pw@example.test", code)
  ]) {
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "Invalid or expired code");
  }

  assert.equal((await reset("reset-bad@example.test", code)).status, 200);
  const again = await reset("reset-bad@example.test", code, "Another9876$");
  assert.equal(again.status, 400);
  assert.equal(again.json.message, "Invalid or expired code");
});

test("reset: 5 ghalat koshishon ke baad sahi code bhi nahi chalta", async () => {
  await ctx.verifiedAccount("reset-five@example.test", OLD);
  await forgot("reset-five@example.test");
  const code = resetCodes("reset-five@example.test").at(-1);
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await reset("reset-five@example.test", wrong);
  assert.equal((await reset("reset-five@example.test", code)).status, 400);
});

test("reset: naya password register wale qaidon par — kamzor par field ke saath 400, code kharch nahi hota", async () => {
  await ctx.verifiedAccount("reset-weak@example.test", OLD);
  await forgot("reset-weak@example.test");
  const code = resetCodes("reset-weak@example.test").at(-1);

  const weak = await reset("reset-weak@example.test", code, "weakpass");
  assert.equal(weak.status, 400);
  assert.deepEqual(weak.json.errors, [{ field: "password", message: "Password must contain at least one uppercase letter" }]);
  assert.equal((await reset("reset-weak@example.test", code)).status, 200);
});

test("reset: saare devices logout — purana access token aur refresh cookie dono 401; lock bhi saaf", async () => {
  const session = await ctx.verifiedAccount("reset-all@example.test", OLD);
  const userId = session.json.user._id;
  assert.equal((await ctx.request("GET", "/user/profile", { token: oldToken(userId) })).status, 200);

  // account lock — 5 ghalat logins
  for (let i = 0; i < 5; i++) await ctx.login({ email: "reset-all@example.test", password: "Wrong1234!" });
  assert.equal((await ctx.login({ email: "reset-all@example.test", password: OLD })).status, 423);

  await forgot("reset-all@example.test");
  assert.equal((await reset("reset-all@example.test", resetCodes("reset-all@example.test").at(-1))).status, 200);

  const stale = await ctx.request("GET", "/user/profile", { token: oldToken(userId) });
  assert.equal(stale.status, 401);
  assert.equal(stale.json.message, "Invalid or expired token");
  assert.equal(await refreshWith(session.cookie), 401);
  assert.equal(await ctx.mongoose.model("RefreshToken").countDocuments({ user: userId }), 0);

  // lock saaf — naye password se foran login
  assert.equal((await ctx.login({ email: "reset-all@example.test", password: NEW })).status, 200);
});

// ---------- change-password ----------

test("change: sahi purane password se — yeh device naya token + cookie paata hai, baqi sessions band", async () => {
  const first = await ctx.verifiedAccount("change-ok@example.test", OLD);
  const second = await ctx.login({ email: "change-ok@example.test", password: OLD });
  const userId = first.json.user._id;

  const res = await ctx.request("POST", "/user/change-password", {
    token: second.json.token,
    body: { currentPassword: OLD, newPassword: NEW }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "Your password has been changed. Other devices have been logged out.");
  assert.equal(res.json.user.email, "change-ok@example.test");
  assert.equal(res.json.user.passwordChangedAt, undefined);
  assert.match(res.cookie, /^refreshToken=[a-f0-9]{64};.*Path=\/auth/);

  // naya token chalta hai, purana (pehle ka iat) nahi
  assert.equal((await ctx.request("GET", "/user/profile", { token: res.json.token })).status, 200);
  assert.equal((await ctx.request("GET", "/user/profile", { token: oldToken(userId) })).status, 401);

  // doosre device ki cookie mit chuki; is device ki nayi cookie chalti hai (aur doosre ki koshish ise band nahi karti)
  assert.equal(await refreshWith(first.cookie), 401);
  assert.equal(await refreshWith(res.cookie), 200);

  assert.equal((await ctx.login({ email: "change-ok@example.test", password: OLD })).status, 401);
  assert.equal((await ctx.login({ email: "change-ok@example.test", password: NEW })).status, 200);
});

test("change: ghalat purana password 403 (401 nahi); wahi password 400; kamzor naya 400 newPassword field", async () => {
  const { json } = await ctx.verifiedAccount("change-bad@example.test", OLD);
  const change = (body) => ctx.request("POST", "/user/change-password", { token: json.token, body });

  const wrong = await change({ currentPassword: "Nope1234!", newPassword: NEW });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.json.message, "Incorrect password");

  const same = await change({ currentPassword: OLD, newPassword: OLD });
  assert.equal(same.status, 400);
  assert.equal(same.json.message, "New password must be different from your current password");

  const weak = await change({ currentPassword: OLD, newPassword: "short" });
  assert.equal(weak.status, 400);
  assert.deepEqual(weak.json.errors, [{ field: "newPassword", message: "New password must be at least 8 characters" }]);

  const missing = await change({});
  assert.deepEqual(missing.json.errors.map((e) => e.field), ["currentPassword", "newPassword"]);

  // kuch nahi badla
  assert.equal((await ctx.login({ email: "change-bad@example.test", password: OLD })).status, 200);
});

test("change: 5 ghalat purane passwords par account lock (423) — chura hua token password ka andaza nahi laga sakta", async () => {
  const { json } = await ctx.verifiedAccount("change-lock@example.test", OLD);
  const statuses = [];
  for (let i = 0; i < 5; i++) {
    statuses.push((await ctx.request("POST", "/user/change-password", { token: json.token, body: { currentPassword: "Nope1234!", newPassword: NEW } })).status);
  }
  assert.deepEqual(statuses, [403, 403, 403, 403, 423]);
  assert.equal((await ctx.request("POST", "/user/change-password", { token: json.token, body: { currentPassword: OLD, newPassword: NEW } })).status, 423);
});

test("change: bina token 401", async () => {
  const res = await ctx.request("POST", "/user/change-password", { body: { currentPassword: OLD, newPassword: NEW } });
  assert.equal(res.status, 401);
});

test("bina iat wala token rad — password check iat ke baghair ho hi nahi sakta", async () => {
  const { json } = await ctx.verifiedAccount("no-iat@example.test", OLD);
  const token = jwt.sign({ sub: json.user._id }, ctx.config.jwtSecret, { algorithm: "HS256", expiresIn: "15m", noTimestamp: true });
  assert.equal((await ctx.request("GET", "/user/profile", { token })).status, 401);
});
