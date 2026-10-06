// account lockout — 5 lagataar galat password par 15 minute band (authService.checkCredentials)
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js); IP limiter stub, sirf account wala lock test hota hai
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("lockout");
const { mongoose, post } = ctx;
const PASSWORD = "Valid1234";
const WRONG = "Wrong1234";

const login = (email, password) => post("/auth/login", { email, password });
const userDoc = (email) => mongoose.model("User").findOne({ email }).lean();

before(() => ctx.start());
after(() => ctx.stop());

test("5 galat → 5vi par 423; band waqt mein SAHI password bhi 423, na token na cookie; bacha waqt sahi", async () => {
  await ctx.verifiedAccount("lock@example.com");

  for (let i = 1; i <= 4; i++) {
    const res = await login("lock@example.com", WRONG);
    assert.equal(res.status, 401, `koshish ${i}`);
    assert.equal(res.json.message, "Invalid email or password");
  }

  const fifth = await login("lock@example.com", WRONG);
  assert.equal(fifth.status, 423);
  assert.equal(fifth.json.message, "Account locked due to too many failed login attempts. Try again in 15 minutes.");

  const correct = await fetch(`${ctx.baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ctx.config.apiKey },
    body: JSON.stringify({ email: "lock@example.com", password: PASSWORD })
  });
  const body = await correct.json();
  assert.equal(correct.status, 423);
  assert.equal(body.token, undefined);
  assert.equal(correct.headers.get("set-cookie"), null);
  // Retry-After seconds mein — 15 minute ke aas paas
  const retryAfter = Number(correct.headers.get("retry-after"));
  assert.ok(retryAfter > 890 && retryAfter <= 900, `Retry-After=${retryAfter}`);
});

test("lock DB mein hai (restart se nahi tootta), aur band waqt mein galtiyan ginti nahi badhati", async () => {
  await ctx.verifiedAccount("persist@example.com");
  for (let i = 0; i < 5; i++) await login("persist@example.com", WRONG);

  const doc = await userDoc("persist@example.com");
  assert.ok(doc.lockUntil > new Date(), "lockUntil DB mein aage ka waqt");
  assert.equal(doc.failedLoginAttempts, 0, "lock lagte hi ginti 0 — lock khatam hone par phir 5 koshishen");

  // band waqt mein aur galtiyan — lock ka waqt aage nahi khisakta, ginti nahi badhti
  await login("persist@example.com", WRONG);
  const after = await userDoc("persist@example.com");
  assert.equal(after.lockUntil.getTime(), doc.lockUntil.getTime());
  assert.equal(after.failedLoginAttempts, 0);
});

test("15 minute baad sahi password chalta hai, aur ginti reset", async () => {
  await ctx.verifiedAccount("expire@example.com");
  for (let i = 0; i < 5; i++) await login("expire@example.com", WRONG);
  // waqt guzra — lockUntil peeche kar do
  await mongoose.model("User").updateOne({ email: "expire@example.com" }, { $set: { lockUntil: new Date(Date.now() - 1000) } });

  const res = await login("expire@example.com", PASSWORD);
  assert.equal(res.status, 200);
  assert.ok(res.json.token);
  const doc = await userDoc("expire@example.com");
  assert.equal(doc.failedLoginAttempts, 0);
  assert.equal(doc.lockUntil, null);
});

test("kamyab login ginti reset karta hai — 4 galat, sahi, 4 galat → lock nahi", async () => {
  await ctx.verifiedAccount("reset@example.com");
  for (let i = 0; i < 4; i++) await login("reset@example.com", WRONG);
  assert.equal((await userDoc("reset@example.com")).failedLoginAttempts, 4);

  assert.equal((await login("reset@example.com", PASSWORD)).status, 200);
  assert.equal((await userDoc("reset@example.com")).failedLoginAttempts, 0);

  for (let i = 0; i < 4; i++) assert.equal((await login("reset@example.com", WRONG)).status, 401);
  assert.equal((await login("reset@example.com", PASSWORD)).status, 200);
});

test("ek band account doosre user ko nahi rokta; na-maujood email hamesha 401", async () => {
  await ctx.verifiedAccount("victim@example.com");
  await ctx.verifiedAccount("bystander@example.com");
  for (let i = 0; i < 5; i++) await login("victim@example.com", WRONG);
  assert.equal((await login("victim@example.com", PASSWORD)).status, 423);
  assert.equal((await login("bystander@example.com", PASSWORD)).status, 200);

  for (let i = 1; i <= 7; i++) {
    const res = await login("nobody@example.com", WRONG);
    assert.equal(res.status, 401, `na-maujood email, koshish ${i}`);
  }
});

test("10 parallel galat → ek hi lock, ginti chhoot'ti nahi; response mein lockout fields nahi", async () => {
  await ctx.verifiedAccount("race@example.com");
  const results = await Promise.all(Array.from({ length: 10 }, () => login("race@example.com", WRONG)));
  assert.ok(results.some((r) => r.status === 423), "kam se kam ek 423");
  assert.ok(results.every((r) => r.status === 401 || r.status === 423));
  const doc = await userDoc("race@example.com");
  assert.ok(doc.lockUntil > new Date());
  assert.equal((await login("race@example.com", PASSWORD)).status, 423);

  // login ke jawab mein user object — andar ki halat (ginti, lockUntil) bahar nahi
  const { json } = await ctx.verifiedAccount("fields@example.com");
  assert.equal(json.user.failedLoginAttempts, undefined);
  assert.equal(json.user.lockUntil, undefined);
});

test("parallel galtiyan lock ke baad ginti nahi chadhatin — lock khatam hone par poori 5 koshishen", async () => {
  await ctx.verifiedAccount("burst@example.com");
  // 20 ek saath — kuch lock lagne se pehle padh chuki hoti hain aur lock ke baad +1 karti thin
  await Promise.all(Array.from({ length: 20 }, () => login("burst@example.com", WRONG)));
  const doc = await userDoc("burst@example.com");
  assert.ok(doc.lockUntil > new Date());
  assert.equal(doc.failedLoginAttempts, 0, "band waqt mein ginti 0 hi rahe");

  // lock khatam — ab pehli galti par 401 (pehle 423 aa jaata tha), 5vi par hi lock
  await mongoose.model("User").updateOne({ email: "burst@example.com" }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await login("burst@example.com", WRONG)).status);
  assert.deepEqual(statuses, [401, 401, 401, 401, 423]);
});
