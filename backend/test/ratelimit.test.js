// asli rate limiters — baaki test files inhe stub karti hain
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("ratelimit", { realLimiters: true });
const resend = (email) => ctx.post("/auth/resend-verification", { email });

before(() => ctx.start());
after(() => ctx.stop());

// IP limiter (5 per 15 min) bhi asli hai — is liye poora check 5 requests mein
test("resend: ek email par 60s mein ek hi request; har email par, account ho ya na ho", async () => {
  await ctx.post("/auth/register", { email: "cool@example.com", password: "Valid1234" });

  assert.equal((await resend("cool@example.com")).status, 200);
  const second = await resend("cool@example.com");
  assert.equal(second.status, 429);
  assert.equal(second.json.message, "Please wait a minute before requesting another code.");
  // case/spaces badal kar, aur purane alias se bhi nahi bachta — ek hi ginti
  assert.equal((await ctx.post("/resend-verification", { email: "  COOL@Example.com " })).status, 429);

  // account na ho tab bhi wahi cooldown — warna 429 batata ke yahan account hai
  // (pehli request 200 = doosre email ki ginti alag)
  assert.equal((await resend("nobody@example.com")).status, 200);
  assert.equal((await resend("nobody@example.com")).status, 429);
});

test("register: ek IP se ghante mein 10 — 11th par 429; validation ki galtiyan (400) ginti mein nahi", async () => {
  // typos — limit nahi khaate (pehle ye bhi gin jaate the)
  for (let i = 0; i < 12; i++) {
    const invalid = await ctx.post("/auth/register", { email: `typo${i}@example.com`, password: "short" });
    assert.equal(invalid.status, 400);
  }
  // pehle test ne 1 register kiya — ab tak ki ginti ke saath 11th tak
  const statuses = [];
  for (let i = 0; i < 10; i++) {
    statuses.push((await ctx.post("/auth/register", { email: `bulk${i}@example.com`, password: "Valid1234" })).status);
  }
  assert.deepEqual(statuses.slice(0, 9), Array(9).fill(201));
  const last = statuses.at(-1);
  assert.equal(last, 429);
});

test("login: account lockout (5) IP limit (50) se pehle — ek account ki galtiyan network band nahi karti", async () => {
  // users seedha DB mein — register ki IP had (10) is file ka pichla test pehle hi poori kar chuka hai
  const passwordHash = await require("bcryptjs").hash("Valid1234", 12);
  await ctx.mongoose.model("User").create([
    { email: "ip-a@example.com", password: passwordHash, isVerified: true },
    { email: "ip-b@example.com", password: passwordHash, isVerified: true }
  ]);
  const login = (email, password) => ctx.post("/auth/login", { email, password });

  // ek account par 5 galat → account lock (423), IP limit nahi (429)
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await login("ip-a@example.com", "Wrong1234")).status);
  assert.deepEqual(statuses, [401, 401, 401, 401, 423]);

  // usi IP se doosra account — pehli galti par 401 (pehle 10 ki IP had par yahan 429 aata), sahi par 200
  assert.equal((await login("ip-b@example.com", "Wrong1234")).status, 401);
  assert.equal((await login("ip-b@example.com", "Valid1234")).status, 200);

  // IP had (50 galat) — phir har email par 429, message mein "from this network" aur asal minute
  let last;
  for (let i = 0; i < 50; i++) last = await login(`spray${i}@example.com`, "Wrong1234");
  assert.equal(last.status, 429);
  assert.match(last.json.message, /^Too many failed login attempts from this network\. Please try again in \d+ minutes?\.$/);
});

test("verify-email: IP had 50 galat (10 nahi) — ek network par kuch galat codes se baaki users nahi rukte", async () => {
  const verify = (i) => ctx.post("/auth/verify-email", { email: `nobody-v${i}@example.com`, otp: "123456", password: "Valid1234" });
  // 11th galat code — pehle yahan 429 aata tha
  for (let i = 0; i < 11; i++) {
    assert.equal((await verify(i)).status, 400);
  }
  let last;
  for (let i = 11; i <= 50; i++) last = await verify(i);
  assert.equal(last.status, 429);
  assert.equal(last.json.message, "Too many failed code attempts. Please try again in 15 minutes.");
});
