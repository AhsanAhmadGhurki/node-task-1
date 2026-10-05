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
