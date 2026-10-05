// auth ke tests — register, email verify ka code, login, routes
// chalao: npm test (backend/ se) — asli MongoDB chahiye, lekin ALAG database (test/helpers.js)
// per-user "ghante mein 3 codes" DB wali ginti asli hai — wahi test hoti hai
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("auth");
const { mongoose, config, sentEmails, codesFor, post } = ctx;

const PASSWORD = "Valid1234";

const registerAndVerify = (email, password = PASSWORD) => ctx.verifiedAccount(email, password);

const wrongCode = (otp) => String((Number(otp) + 1) % 1000000).padStart(6, "0");

before(() => ctx.start());
after(() => ctx.stop());

beforeEach(() => {
  sentEmails.length = 0;
});

test("naya register → 201, unverified user, ek code email", async () => {
  const res = await post("/auth/register", { email: "new@example.com", password: PASSWORD });
  assert.equal(res.status, 201);
  assert.equal(res.json.email, "new@example.com");
  assert.equal(res.json.isVerified, false);
  assert.equal(res.json.password, undefined);
  assert.equal(codesFor("new@example.com").length, 1);
  assert.match(codesFor("new@example.com")[0], /^\d{6}$/);
  // code response mein kabhi nahi
  assert.ok(!res.text.includes(codesFor("new@example.com")[0]));
});

test("duplicate VERIFIED email → 409, chahe case/spaces alag hon, koi email nahi", async () => {
  await registerAndVerify("verified@example.com");
  sentEmails.length = 0;

  for (const email of ["verified@example.com", "VERIFIED@Example.com", "  verified@example.com  "]) {
    const res = await post("/auth/register", { email, password: "Other1234" });
    assert.equal(res.status, 409, email);
    assert.equal(res.json.message, "Email already registered");
  }
  assert.equal(sentEmails.length, 0);
  // password nahi badla — purane se login hota hai
  assert.equal((await post("/auth/login", { email: "verified@example.com", password: PASSWORD })).status, 200);
});

test("duplicate UNVERIFIED email → 200 generic (201 nahi), naya code; ghante mein 3 ke baad chup", async () => {
  const first = await post("/auth/register", { email: "pending@example.com", password: PASSWORD });
  assert.equal(first.status, 201);

  const again = await post("/auth/register", { email: "PENDING@example.com", password: PASSWORD });
  assert.equal(again.status, 200);
  assert.deepEqual(again.json, { message: "If an account exists for this email, a verification code has been sent." });
  assert.equal(codesFor("pending@example.com").length, 2);

  await post("/auth/register", { email: "pending@example.com", password: PASSWORD }); // 3rd code
  const limited = await post("/auth/register", { email: "pending@example.com", password: PASSWORD }); // 4th — had
  assert.equal(limited.status, 200, "had poori hone par bhi 429 nahi — batata ke unverified account hai");
  assert.deepEqual(limited.json, again.json);
  assert.equal(codesFor("pending@example.com").length, 3, "4th par email nahi gayi");

  // abhi bhi ek hi user
  assert.equal(await mongoose.model("User").countDocuments({ email: "pending@example.com" }), 1);
});

test("verify → seedha login (token + httpOnly refresh cookie); logout ke baad wahi password chalta hai", async () => {
  await post("/auth/register", { email: "flow@example.com", password: PASSWORD });
  const otp = codesFor("flow@example.com")[0];

  const wrong = await post("/auth/verify-email", { email: "flow@example.com", otp: wrongCode(otp), password: PASSWORD });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.json.message, "Invalid or expired code");

  const verified = await post("/auth/verify-email", { email: "flow@example.com", otp, password: PASSWORD });
  assert.equal(verified.status, 200);
  assert.ok(verified.json.token);
  assert.equal(verified.json.user.isVerified, true);
  assert.match(verified.cookie, /refreshToken=.*HttpOnly/);

  // code ek hi dafa
  assert.equal((await post("/auth/verify-email", { email: "flow@example.com", otp, password: PASSWORD })).status, 400);

  sentEmails.length = 0;
  const login = await post("/auth/login", { email: "Flow@Example.com", password: PASSWORD });
  assert.equal(login.status, 200);
  assert.ok(login.json.token);
  assert.equal(sentEmails.length, 0, "login par koi code/email nahi");
});

test("squatting: kisi aur ka email pehle register karne wale ka password nahi chalta", async () => {
  await post("/auth/register", { email: "victim@example.com", password: "Attacker123" });
  await post("/auth/register", { email: "victim@example.com", password: "Victim1234" });
  // attacker phir se — aakhri code attacker ke register ka
  await post("/auth/register", { email: "victim@example.com", password: "Attacker123" });
  const otp = codesFor("victim@example.com").at(-1);

  // asli malik (inbox wala) apne password ke saath verify karta hai
  assert.equal((await post("/auth/verify-email", { email: "victim@example.com", otp, password: "Victim1234" })).status, 200);
  assert.equal((await post("/auth/login", { email: "victim@example.com", password: "Attacker123" })).status, 401);
  assert.equal((await post("/auth/login", { email: "victim@example.com", password: "Victim1234" })).status, 200);
});

test("5 galat koshishon ke baad code band; resend ke baad purana code band", async () => {
  await post("/auth/register", { email: "attempts@example.com", password: PASSWORD });
  const otp = codesFor("attempts@example.com")[0];
  for (let i = 0; i < 5; i++) {
    await post("/auth/verify-email", { email: "attempts@example.com", otp: wrongCode(otp), password: PASSWORD });
  }
  assert.equal((await post("/auth/verify-email", { email: "attempts@example.com", otp, password: PASSWORD })).status, 400);

  const resend = await post("/auth/resend-verification", { email: "attempts@example.com" });
  assert.equal(resend.status, 200);
  const fresh = codesFor("attempts@example.com").at(-1);
  assert.notEqual(fresh, otp);
  assert.equal((await post("/auth/verify-email", { email: "attempts@example.com", otp, password: PASSWORD })).status, 400);
  assert.equal((await post("/auth/verify-email", { email: "attempts@example.com", otp: fresh, password: PASSWORD })).status, 200);
});

test("login: unknown aur galat password ka ek hi 401; unverified + sahi password → 403", async () => {
  await registerAndVerify("known@example.com");
  const unknown = await post("/auth/login", { email: "nobody@example.com", password: PASSWORD });
  const wrong = await post("/auth/login", { email: "known@example.com", password: "Wrong1234" });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.text, wrong.text);

  await post("/auth/register", { email: "unverified@example.com", password: PASSWORD });
  assert.equal((await post("/auth/login", { email: "unverified@example.com", password: PASSWORD })).status, 403);
  assert.equal((await post("/auth/login", { email: "unverified@example.com", password: "Wrong1234" })).status, 401);
});

test("validation kamzor nahi hui", async () => {
  const cases = [
    [{ email: "v@example.com", password: "Abc123" }, "Password must be at least 8 characters"],
    [{ email: "v@example.com", password: "Password" }, "Password must contain at least one number"],
    [{ email: "v@example.com", password: "A1" + "x".repeat(71) }, "Password must be at most 72 bytes"],
    [{ email: "abc@com", password: PASSWORD }, "Please enter a valid email address"],
    [{ email: { $ne: null }, password: PASSWORD }, "Email must be a string"]
  ];
  for (const [body, message] of cases) {
    const res = await post("/auth/register", body);
    assert.equal(res.status, 400, message);
    assert.equal(res.json.message, message);
  }
  const otp = await post("/auth/verify-email", { email: "v@example.com", otp: 123456, password: PASSWORD });
  assert.equal(otp.status, 400);
  assert.equal(otp.json.message, "Code must be a string");
  assert.equal((await post("/auth/login", { email: "v@example.com", password: "A1" + "x".repeat(71) })).status, 400);
});

test("routes: sab /auth/* par, purane root paths alias ki tarah chalte hain", async () => {
  // naye paths
  assert.equal((await post("/auth/register", { email: "route-new@example.com", password: PASSWORD })).status, 201);
  assert.equal((await post("/auth/resend-verification", { email: "route-new@example.com" })).status, 200);
  const newOtp = codesFor("route-new@example.com").at(-1);
  assert.equal((await post("/auth/verify-email", { email: "route-new@example.com", otp: newOtp, password: PASSWORD })).status, 200);

  // purane alias — wahi handler
  assert.equal((await post("/register", { email: "route-old@example.com", password: PASSWORD })).status, 201);
  assert.equal((await post("/resend-verification", { email: "route-old@example.com" })).status, 200);
  const oldOtp = codesFor("route-old@example.com").at(-1);
  assert.equal((await post("/verify-email", { email: "route-old@example.com", otp: oldOtp, password: PASSWORD })).status, 200);

  // link wala purana route hamesha ke liye gaya
  const link = await fetch(`${ctx.baseUrl}/verify/${"a".repeat(64)}`, { headers: { "x-api-key": config.apiKey } });
  assert.equal(link.status, 404);
});

test("delete hue user ka (abhi valid) access token → 401, koi task nahi banta", async () => {
  const account = await registerAndVerify("ghost@example.com");
  const { token, user } = account.json;
  await mongoose.model("User").deleteOne({ _id: user._id });

  const list = await ctx.request("GET", "/tasks", { token });
  const create = await ctx.request("POST", "/tasks", { token, body: { title: "orphan" } });
  assert.equal(list.status, 401);
  assert.equal(create.status, 401);
  assert.equal(list.json.message, "Invalid or expired token");
  assert.equal(await mongoose.model("Task").countDocuments({ user: user._id }), 0);
});

test("API key: galat, chhoti, lambi, missing → 401; sahi → aage", async () => {
  const { json } = await registerAndVerify("key@example.com");
  for (const apiKey of [null, "", "x", config.apiKey.slice(0, -1), config.apiKey + "x", "z".repeat(config.apiKey.length)]) {
    const res = await ctx.request("GET", "/tasks", { token: json.token, apiKey });
    assert.equal(res.status, 401, `apiKey=${apiKey === null ? "missing" : apiKey.length + " chars"}`);
    assert.equal(res.json.message, "Invalid or missing API key");
  }
  assert.equal((await ctx.request("GET", "/tasks", { token: json.token })).status, 200);
});

test("password rules: aage/peeche space nahi, letter + number dono, 8+ — beech ka space theek", async () => {
  const cases = [
    ["        1", "Password must not start or end with a space"],
    [" Valid1234", "Password must not start or end with a space"],
    ["Valid1234 ", "Password must not start or end with a space"],
    ["12345678", "Password must contain at least one letter"],
    ["abcdefgh", "Password must contain at least one number"],
    ["Ab1", "Password must be at least 8 characters"]
  ];
  for (const [password, message] of cases) {
    const res = await post("/auth/register", { email: "rules@example.com", password });
    assert.equal(res.status, 400, JSON.stringify(password));
    assert.equal(res.json.message, message);
  }
  // verify-email bhi wahi rules (password wahan set hota hai)
  const verify = await post("/auth/verify-email", { email: "rules@example.com", otp: "123456", password: "        1" });
  assert.equal(verify.status, 400);
  assert.equal(verify.json.message, "Password must not start or end with a space");

  assert.equal((await post("/auth/register", { email: "rules@example.com", password: "my pass 123" })).status, 201);
  assert.equal((await post("/auth/register", { email: "unicode@example.com", password: "پاسورڈ12345" })).status, 201);
});

test("unverified email dobara register → password NAHI badalta, sirf naya code", async () => {
  await post("/auth/register", { email: "keep@example.com", password: "FirstPass1" });
  const again = await post("/auth/register", { email: "keep@example.com", password: "SecondPass2" });
  assert.equal(again.status, 200);
  assert.equal(codesFor("keep@example.com").length, 2);

  // pehla password abhi bhi account ka hai — 403 (sahi password, lekin unverified); doosra 401
  assert.equal((await post("/auth/login", { email: "keep@example.com", password: "FirstPass1" })).status, 403);
  assert.equal((await post("/auth/login", { email: "keep@example.com", password: "SecondPass2" })).status, 401);
});
