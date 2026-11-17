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
  await ctx.post("/auth/register", { email: "cool@example.com", password: "Valid1234!" });

  assert.equal((await resend("cool@example.com")).status, 200);
  const second = await resend("cool@example.com");
  assert.equal(second.status, 429);
  assert.equal(second.json.message, "Please wait a minute before requesting another code.");
  // bacha hua waqt body mein — seconds (60 tak) aur kab khulega (ISO)
  assert.ok(second.json.retryAfter >= 1 && second.json.retryAfter <= 60, `retryAfter=${second.json.retryAfter}`);
  assert.ok(Math.abs(Date.parse(second.json.resetAt) - (Date.now() + second.json.retryAfter * 1000)) < 2000);
  // case/spaces badal kar, aur purane alias se bhi nahi bachta — ek hi ginti
  assert.equal((await ctx.post("/resend-verification", { email: "  COOL@Example.com " })).status, 429);

  // account na ho tab bhi wahi cooldown — warna 429 batata ke yahan account hai
  // (pehli request 200 = doosre email ki ginti alag)
  assert.equal((await resend("nobody@example.com")).status, 200);
  assert.equal((await resend("nobody@example.com")).status, 429);
});

test("register: ek IP se ghante mein 10 — 11th par 429", async () => {
  // pehle test ne 1 register kiya — ab tak ki ginti ke saath 11th tak
  const statuses = [];
  for (let i = 0; i < 10; i++) {
    statuses.push((await ctx.post("/auth/register", { email: `bulk${i}@example.com`, password: "Valid1234!" })).status);
  }
  assert.deepEqual(statuses.slice(0, 9), Array(9).fill(201));
  const last = statuses.at(-1);
  assert.equal(last, 429);
});

test("login: account lockout (5) IP limit (50) se pehle — ek account ki galtiyan network band nahi karti", async () => {
  // users seedha DB mein — register ki IP had (10) is file ka pichla test pehle hi poori kar chuka hai
  const passwordHash = await require("bcryptjs").hash("Valid1234!", 12);
  await ctx.mongoose.model("User").create([
    { email: "ip-a@example.com", password: passwordHash, isVerified: true },
    { email: "ip-b@example.com", password: passwordHash, isVerified: true }
  ]);
  const login = (email, password) => ctx.login({ email, password });

  // ek account par 5 galat → account lock (423), IP limit nahi (429)
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await login("ip-a@example.com", "Wrong1234")).status);
  assert.deepEqual(statuses, [401, 401, 401, 401, 423]);

  // usi IP se doosra account — pehli galti par 401 (pehle 10 ki IP had par yahan 429 aata), sahi par 200
  assert.equal((await login("ip-b@example.com", "Wrong1234")).status, 401);
  assert.equal((await login("ip-b@example.com", "Valid1234!")).status, 200);

  // IP had (50 galat) — phir har email par 429, message mein "from this network" aur asal minute
  let last;
  for (let i = 0; i < 50; i++) last = await login(`spray${i}@example.com`, "Wrong1234");
  assert.equal(last.status, 429);
  assert.match(last.json.message, /^Too many failed login attempts from this network\. Please try again in \d+ minutes?\.$/);
  assert.ok(last.json.retryAfter > 0 && last.json.retryAfter <= 15 * 60, `retryAfter=${last.json.retryAfter}`);
  assert.equal(typeof last.json.resetAt, "string");

  // request-otp bhi wahi limiter instance — /auth/login se ja kar limit nahi bachti
  assert.equal((await ctx.post("/auth/login/request-otp", { email: "ip-b@example.com", password: "Wrong1234" })).status, 429);
});

test("invites: ek user ghante mein 20 kamyab invites — 21va 429; ghalat/409 wale had nahi khaate; doosra user alag", async () => {
  const jwt = require("jsonwebtoken");
  const passwordHash = await require("bcryptjs").hash("Valid1234!", 12);
  const [owner, other, member] = await ctx.mongoose.model("User").create([
    { email: "inv-owner@example.com", password: passwordHash, isVerified: true },
    { email: "inv-other@example.com", password: passwordHash, isVerified: true },
    { email: "inv-member@example.com", password: passwordHash, isVerified: true }
  ]);
  // login ki IP had pichhle test mein bhar chuki — token seedha (authMiddleware sirf signature, exp aur user dekhta hai)
  const tokenOf = (user) => jwt.sign({ sub: user.id }, ctx.config.jwtSecret, { algorithm: "HS256", expiresIn: "15m" });
  const as = (user) => (route, body) => ctx.request("POST", route, { body, token: tokenOf(user) });

  const orgId = (await as(owner)("/orgs", { name: "Invite limits" })).json.org._id;
  await ctx.mongoose.model("OrganizationMember").create({ org: orgId, user: member.id, role: "member" });
  const invite = (user, email) => as(user)(`/orgs/${orgId}/invitations`, { email, role: "viewer" });

  // fail hone wale — had nahi khaate (ghalat email 400 limiter tak pahunchta hi nahi, 409 gina nahi jaata)
  assert.equal((await invite(owner, "not-an-email")).status, 400);
  assert.equal((await invite(owner, member.email)).status, 409);

  const statuses = [];
  for (let i = 0; i < 20; i++) statuses.push((await invite(owner, `limit${i}@example.com`)).status);
  assert.deepEqual(statuses, Array(20).fill(201));

  const blocked = await invite(owner, "limit20@example.com");
  assert.equal(blocked.status, 429);
  assert.match(blocked.json.message, /^You can send at most 20 invitations per hour\. Please try again in \d+ minutes?\.$/);
  assert.ok(blocked.json.retryAfter > 0 && blocked.json.retryAfter <= 60 * 60, `retryAfter=${blocked.json.retryAfter}`);
  assert.equal(await ctx.mongoose.model("Invitation").countDocuments({ email: "limit20@example.com" }), 0);
  assert.equal(ctx.sentInvites.filter((m) => m.email === "limit20@example.com").length, 0);

  // had user ki hai, IP ki nahi — usi IP se doosra user (apni org mein) bhej sakta hai
  const otherOrg = (await as(other)("/orgs", { name: "Other limits" })).json.org._id;
  assert.equal((await as(other)(`/orgs/${otherOrg}/invitations`, { email: "fresh@example.com", role: "viewer" })).status, 201);
});
