// centralized validation ke tests — express-validator rules + middleware/validate.js ka { message, errors } shape
// register, login, tickets; profile (phone format) ke tests profile.test.js mein
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("validation");
const { mongoose, post } = ctx;

const PASSWORD = "Valid1234!";
const users = () => mongoose.model("User");

before(async () => {
  await ctx.start();
});

after(async () => {
  await ctx.stop();
});

test("register: email aur password dono ghalat → 400, dono galtiyan ek hi errors array mein", async () => {
  const res = await post("/auth/register", { email: "bad", password: "123" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors, [
    { field: "email", message: "Please enter a valid email address" },
    { field: "password", message: "Password must be at least 8 characters" }
  ]);
  // message = pehli galti — purana frontend sirf yahi padhta hai
  assert.equal(res.json.message, "Please enter a valid email address");
});

test("register: khaali body → dono fields 'required'", async () => {
  const res = await post("/auth/register", undefined);
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors, [
    { field: "email", message: "Email is required" },
    { field: "password", message: "Password is required" }
  ]);
});

test("register: har field ki sirf pehli galti (ek field ke 3 rules toote to bhi 1 item)", async () => {
  // "   " — required, aur format dono toot-te; sirf "required" aana chahiye
  const res = await post("/auth/register", { email: "   ", password: PASSWORD });
  assert.deepEqual(res.json.errors, [{ field: "email", message: "Email is required" }]);
});

test("register: ghair-string values (NoSQL operator, array, number) → 'must be a string'", async () => {
  const res = await post("/auth/register", { email: { $ne: null }, password: 12345678 });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors, [
    { field: "email", message: "Email must be a string" },
    { field: "password", message: "Password must be a string" }
  ]);
  assert.equal((await post("/auth/register", { email: ["a@b.co"], password: PASSWORD })).json.message, "Email must be a string");
});

test("email normalization: '  Test@Email.com  ' DB mein 'test@email.com' save hota hai", async () => {
  const res = await post("/auth/register", { email: "  Test@Email.com  ", password: PASSWORD });
  assert.equal(res.status, 201);
  const saved = await users().find({ email: /test@email\.com/i }).lean();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].email, "test@email.com");
  // code bhi normalize hui email par gaya
  assert.equal(ctx.codesFor("test@email.com").length, 1);
});

test("email normalization: alag case/spaces wali email se duplicate account nahi banta", async () => {
  const { json } = await ctx.verifiedAccount("dup@example.test");
  assert.ok(json.token);
  for (const email of ["DUP@example.test", "  Dup@Example.Test  "]) {
    const res = await post("/auth/register", { email, password: PASSWORD });
    assert.equal(res.status, 409, email);
  }
  assert.equal(await users().countDocuments({ email: "dup@example.test" }), 1);
});

test("unique index: ek saath 5 register (alag case) → DB mein sirf 1 user", async () => {
  const variants = ["race@example.test", "RACE@example.test", " Race@Example.test", "race@EXAMPLE.TEST", "rAcE@example.test "];
  const results = await Promise.all(variants.map((email) => post("/auth/register", { email, password: PASSWORD })));
  // koi 500 nahi — 11000 wala error bhi 409 ban jaata hai
  for (const res of results) {
    assert.ok([200, 201, 409].includes(res.status), String(res.status));
  }
  assert.equal(results.filter((res) => res.status === 201).length, 1);
  assert.equal(await users().countDocuments({ email: "race@example.test" }), 1);
});

test("login: alag case aur spaces wali email se bhi login (normalize ho kar)", async () => {
  await ctx.verifiedAccount("login-case@example.test");
  const res = await post("/auth/login", { email: "  LOGIN-Case@Example.TEST ", password: PASSWORD });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.email, "login-case@example.test");
});

test("login: ghalat email format aur khaali password → dono galtiyan ek saath", async () => {
  const res = await post("/auth/login", { email: "not-an-email", password: "" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors, [
    { field: "email", message: "Please enter a valid email address" },
    { field: "password", message: "Password is required" }
  ]);
});

test("login: purane (kamzor) password rules login par nahi lagte — sirf required + 72 bytes", async () => {
  // sahi format, account nahi — validation pass, phir generic 401 (400 nahi)
  const res = await post("/auth/login", { email: "nobody@example.test", password: "short" });
  assert.equal(res.status, 401);
});

test("valid register → 201, response mein errors nahi", async () => {
  const res = await post("/auth/register", { email: "valid@example.test", password: PASSWORD });
  assert.equal(res.status, 201);
  assert.equal(res.json.errors, undefined);
});

test("ticket: title aur description dono ghalat → dono galtiyan ek saath", async () => {
  const { json } = await ctx.verifiedAccount("ticket-validation@example.test");
  const create = (body) => ctx.request("POST", "/tickets", { body, token: json.token });

  const res = await create({ title: "abc", description: "x".repeat(1001) });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors, [
    { field: "title", message: "Title must be between 5 and 100 characters" },
    { field: "description", message: "Description must be at most 1000 characters" }
  ]);

  // hadd par (5 aur 100 characters, 1000 description) → 201; trim ke baad gina jaata hai
  assert.equal((await create({ title: "  abcde  ", description: "x".repeat(1000) })).status, 201);
  assert.equal((await create({ title: "x".repeat(100), description: "ok" })).status, 201);
});

// Step 8 — mazboot password: uppercase (A–Z) + number (0–9) + special character
test("strong password: har shart alag se — uppercase, number, special na ho to apna message", async () => {
  const cases = [
    ["valid1234!", "Password must contain at least one uppercase letter"],
    ["VALIDPASS!", "Password must contain at least one number"],
    ["Valid12345", "Password must contain at least one special character (e.g. !@#$%)"],
    // beech ka space special character nahi ginta
    ["Valid 1234", "Password must contain at least one special character (e.g. !@#$%)"],
    // é uppercase A–Z nahi
    ["éclair123!", "Password must contain at least one uppercase letter"]
  ];
  for (const [password, message] of cases) {
    const res = await post("/auth/register", { email: "strong@example.test", password });
    assert.equal(res.status, 400, password);
    assert.deepEqual(res.json.errors, [{ field: "password", message }], password);
  }
});

test("strong password: alag alag special characters sab chalte hain", async () => {
  const specials = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ".", "_", "-", "?", "~"];
  for (const [i, special] of specials.entries()) {
    const res = await post("/auth/register", { email: `special${i}@example.test`, password: `Valid123${special}` });
    assert.equal(res.status, 201, special);
  }
});

test("strong password: verify-email par bhi wahi shart (password wahin set hota hai)", async () => {
  await post("/auth/register", { email: "verify-strong@example.test", password: PASSWORD });
  const otp = ctx.codesFor("verify-strong@example.test").at(-1);
  const weak = await post("/auth/verify-email", { email: "verify-strong@example.test", otp, password: "Weakpass1" });
  assert.equal(weak.status, 400);
  assert.deepEqual(weak.json.errors, [{ field: "password", message: "Password must contain at least one special character (e.g. !@#$%)" }]);
  // code kharch nahi hua — mazboot password ke saath wahi code chalta hai
  assert.equal((await post("/auth/verify-email", { email: "verify-strong@example.test", otp, password: PASSWORD })).status, 200);
});

test("verify-email: code aur password dono ghalat → dono galtiyan ek saath", async () => {
  const res = await post("/auth/verify-email", { email: "x@example.test", otp: "12ab", password: "weak" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors, [
    { field: "otp", message: "Code must be 6 digits" },
    { field: "password", message: "Password must be at least 8 characters" }
  ]);
});

test("strong password: login par nahi lagta — purana kamzor password wala user login kar sakta hai", async () => {
  // naye rules se pehle bana user — seedha DB mein (register ab ye password qabool nahi karta)
  const password = await require("bcryptjs").hash("oldpass123", 12);
  await users().create({ email: "old-user@example.test", password, isVerified: true });
  const res = await post("/auth/login", { email: "old-user@example.test", password: "oldpass123" });
  assert.equal(res.status, 200);
});
