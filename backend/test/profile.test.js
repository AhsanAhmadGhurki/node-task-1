// profile update ke tests — PATCH /user/profile (name, phone)
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("profile");

let token;

const patch = (body, { auth = true } = {}) => ctx.request("PATCH", "/user/profile", { body, token: auth ? token : undefined });

before(async () => {
  await ctx.start();
  token = (await ctx.verifiedAccount("profile@example.test")).json.token;
});

after(async () => {
  await ctx.stop();
});

test("sahi name + phone → 200, trim ho kar save, password response mein nahi", async () => {
  const res = await patch({ name: "  Ali Khan  ", phone: " 03001234567 " });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.name, "Ali Khan");
  assert.equal(res.json.user.phone, "03001234567");
  assert.equal(res.json.user.password, undefined);
});

test("sirf ek field — doosri waisi hi rehti hai (partial update)", async () => {
  await patch({ name: "Pehla Naam", phone: "03111111111" });
  const res = await patch({ phone: "03222222222" });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.name, "Pehla Naam");
  assert.equal(res.json.user.phone, "03222222222");
});

test("phone format: 03 se shuru, bilkul 11 digits — baaki sab 400", async () => {
  for (const phone of ["0300123456", "030012345678", "04001234567", "+923001234567", "0300-1234567", "0300 1234567", "03oo1234567"]) {
    const res = await patch({ phone });
    assert.equal(res.status, 400, phone);
    assert.deepEqual(res.json.errors, [{ field: "phone", message: "Phone must be in the format 03XXXXXXXXX (11 digits)" }]);
  }
  assert.equal((await patch({ phone: 3001234567 })).json.message, "Phone must be a string");
});

test("name aur phone dono ghalat → dono galtiyan ek saath", async () => {
  const res = await patch({ name: "A", phone: "123" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.errors.map((e) => e.field), ["name", "phone"]);
  assert.equal(res.json.message, "Name must be between 2 and 50 characters");
});

test("anjaan fields (email, isVerified) → 400, kuch nahi badalta", async () => {
  const res = await patch({ name: "Hacker", isVerified: false, email: "x@example.test" });
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "Unsupported field(s): isVerified, email");
  const user = await ctx.mongoose.model("User").findOne({ email: "profile@example.test" }).lean();
  assert.notEqual(user.name, "Hacker");
  assert.equal(user.isVerified, true);
});

test("GET /user/profile → DB wali taaza profile, password nahi; token nahi → 401", async () => {
  await patch({ name: "Taaza Naam", phone: "03331234567" });
  const res = await ctx.request("GET", "/user/profile", { token });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.email, "profile@example.test");
  assert.equal(res.json.user.name, "Taaza Naam");
  assert.equal(res.json.user.phone, "03331234567");
  assert.equal(res.json.user.password, undefined);
  assert.equal((await ctx.request("GET", "/user/profile")).status, 401);
});

test("khaali body → 400; token nahi → 401", async () => {
  assert.equal((await patch({})).json.message, "Provide name or phone to update");
  assert.equal((await patch(undefined)).json.message, "Provide name or phone to update");
  assert.equal((await patch({ name: "Ali" }, { auth: false })).status, 401);
});
