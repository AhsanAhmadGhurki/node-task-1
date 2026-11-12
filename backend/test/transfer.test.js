// ownership transfer ke tests — sirf owner, password dobara (ghalat 403, lockout 423), naya owner isi org ka member,
// transaction (rollback), parallel transfer, ownerCount, cross-org 404
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("transfer");

const PASSWORD = "Valid1234!";

// alice owner, adam admin, mona member, vic viewer (har test ki apni org); bob = Org B ka owner
let alice;
let adam;
let mona;
let vic;
let bob;

const Org = () => mongoose.model("Organization");
const Member = () => mongoose.model("OrganizationMember");

const as = (who) => ({
  get: (route) => ctx.request("GET", route, { token: who.token }),
  post: (route, body) => ctx.request("POST", route, { body, token: who.token }),
  delete: (route) => ctx.request("DELETE", route, { token: who.token })
});

const account = async (email) => {
  const { json } = await ctx.verifiedAccount(email, PASSWORD);
  return { token: json.token, id: json.user._id, email };
};

async function orgWithRoles(owner = alice, name = "Team") {
  const { json } = await as(owner).post("/orgs", { name });
  const orgId = json.org._id;
  await Member().insertMany([
    { org: orgId, user: adam.id, role: "admin" },
    { org: orgId, user: mona.id, role: "member" },
    { org: orgId, user: vic.id, role: "viewer" }
  ]);
  return orgId;
}

const transfer = (who, orgId, newOwnerId, password = PASSWORD) =>
  as(who).post(`/orgs/${orgId}/transfer-ownership`, { newOwnerId, password });

const roleOf = async (orgId, userId) => (await Member().findOne({ org: orgId, user: userId }))?.role;

// ownerCount === asli owners
async function owners(orgId) {
  const count = await Member().countDocuments({ org: orgId, role: "owner" });
  assert.equal((await Org().findById(orgId)).ownerCount, count, "ownerCount === owner memberships");
  return count;
}

before(async () => {
  await ctx.start();
  alice = await account("alice-tr@example.test");
  adam = await account("adam-tr@example.test");
  mona = await account("mona-tr@example.test");
  vic = await account("vic-tr@example.test");
  bob = await account("bob-tr@example.test");
});

after(async () => {
  await ctx.stop();
});

test("owner sahi password ke saath → 200; naya member owner, purana admin; ownerCount 1; password response mein nahi", async () => {
  const orgId = await orgWithRoles();
  const res = await transfer(alice, orgId, mona.id);
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "Ownership transferred");
  assert.equal(res.json.newOwner.user.email, mona.email);
  assert.equal(res.json.newOwner.role, "owner");
  assert.equal(res.json.previousOwner.user.email, alice.email);
  assert.equal(res.json.previousOwner.role, "admin");
  assert.ok(!res.text.includes(PASSWORD));

  assert.equal(await roleOf(orgId, mona.id), "owner");
  assert.equal(await roleOf(orgId, alice.id), "admin");
  assert.equal(await owners(orgId), 1);

  // ab alice (admin) org delete nahi kar sakti, mona (owner) kar sakti hai
  assert.equal((await as(alice).delete(`/orgs/${orgId}`)).status, 403);
  assert.equal((await transfer(alice, orgId, mona.id)).status, 403, "purana owner dobara transfer nahi kar sakta");
  assert.equal((await as(mona).delete(`/orgs/${orgId}`)).status, 200);
});

test("viewer aur admin ko bhi owner bana sakte hain", async () => {
  for (const target of [vic, adam]) {
    const orgId = await orgWithRoles();
    assert.equal((await transfer(alice, orgId, target.id)).status, 200);
    assert.equal(await roleOf(orgId, target.id), "owner");
    assert.equal(await owners(orgId), 1);
  }
});

test("ghalat password → 403 Incorrect password; kuch nahi badla", async () => {
  const orgId = await orgWithRoles();
  const res = await transfer(alice, orgId, mona.id, "Ghalat1234!");
  assert.equal(res.status, 403);
  assert.deepEqual(res.json, { message: "Incorrect password" });
  assert.equal(await roleOf(orgId, alice.id), "owner");
  assert.equal(await roleOf(orgId, mona.id), "member");
  // sahi password ne ginti saaf kar di
  assert.equal((await transfer(alice, orgId, mona.id)).status, 200);
  assert.equal((await mongoose.model("User").findById(alice.id)).failedLoginAttempts, 0);
});

test("password ke andaze — login wali lockout: 5vi galti par 423, phir sahi password bhi nahi (login bhi band)", async () => {
  const owen = await account("owen-tr@example.test");
  const orgId = await orgWithRoles(owen);

  for (let i = 1; i <= 4; i += 1) {
    assert.equal((await transfer(owen, orgId, mona.id, `Ghalat${i}234!`)).status, 403);
  }
  const fifth = await transfer(owen, orgId, mona.id, "Ghalat5234!");
  assert.equal(fifth.status, 423);
  assert.ok(fifth.json.retryAfter > 0);

  assert.equal((await transfer(owen, orgId, mona.id)).status, 423, "sahi password bhi band");
  assert.equal((await ctx.post("/auth/login/request-otp", { email: owen.email, password: PASSWORD })).status, 423);
  assert.equal(await roleOf(orgId, owen.id), "owner");
});

test("validation — newOwnerId ya password na ho → 400", async () => {
  const orgId = await orgWithRoles();
  const noPassword = await as(alice).post(`/orgs/${orgId}/transfer-ownership`, { newOwnerId: mona.id });
  assert.equal(noPassword.status, 400);
  assert.equal(noPassword.json.message, "Password is required");

  const noTarget = await as(alice).post(`/orgs/${orgId}/transfer-ownership`, { password: PASSWORD });
  assert.equal(noTarget.status, 400);
  assert.equal(noTarget.json.errors[0].field, "newOwnerId");
  assert.equal(await owners(orgId), 1);
});

test("admin, member, viewer transfer nahi kar sakte → 403 (sahi password ke saath bhi)", async () => {
  const orgId = await orgWithRoles();
  for (const who of [adam, mona, vic]) {
    const res = await transfer(who, orgId, who === adam ? mona.id : adam.id);
    assert.equal(res.status, 403);
    assert.match(res.json.message, /owner role or higher/);
  }
  assert.equal(await roleOf(orgId, alice.id), "owner");
});

test("naya owner isi org ka member ho — doosri org ka user, anjaan ya ghalat id → 404; password check pehle", async () => {
  const orgId = await orgWithRoles();
  for (const id of [bob.id, new mongoose.Types.ObjectId().toString(), "abc"]) {
    const res = await transfer(alice, orgId, id);
    assert.equal(res.status, 404, id);
    assert.deepEqual(res.json, { message: "Member not found" });
  }
  assert.equal(await owners(orgId), 1);
});

test("khud ko → 400; pehle se owner ko → 400", async () => {
  const orgId = await orgWithRoles();
  const self = await transfer(alice, orgId, alice.id);
  assert.equal(self.status, 400);
  assert.equal(self.json.message, "You are already an owner. Choose another member.");

  await Member().updateOne({ org: orgId, user: mona.id }, { role: "owner" });
  await Org().updateOne({ _id: orgId }, { ownerCount: 2 });
  const already = await transfer(alice, orgId, mona.id);
  assert.equal(already.status, 400);
  assert.equal(already.json.message, "This member is already an owner");
  assert.equal(await owners(orgId), 2);
});

test("cross-org — Org B ka owner Org A mein transfer nahi kar sakta → 404 (ghalat body par bhi)", async () => {
  const orgId = await orgWithRoles();
  for (const body of [{ newOwnerId: bob.id, password: PASSWORD }, {}]) {
    const res = await as(bob).post(`/orgs/${orgId}/transfer-ownership`, body);
    assert.equal(res.status, 404);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }
  assert.equal(await roleOf(orgId, alice.id), "owner");
  assert.equal(await roleOf(orgId, bob.id), undefined);
});

test("transaction rollback — naya owner ban chuka, purane ko admin karte waqt galti → 500, sab waisa hi", async () => {
  const orgId = await orgWithRoles();
  const original = Member().updateOne;
  let calls = 0;
  // pehli updateOne (promote) chalne do, doosri (demote) par galti
  Member().updateOne = function patched(...args) {
    calls += 1;
    if (calls === 2) {
      return Promise.reject(new Error("simulated DB failure"));
    }
    return original.apply(this, args);
  };
  try {
    const res = await transfer(alice, orgId, mona.id);
    assert.equal(res.status, 500);
  } finally {
    Member().updateOne = original;
  }

  assert.equal(calls, 2);
  assert.equal(await roleOf(orgId, mona.id), "member", "promote wapas");
  assert.equal(await roleOf(orgId, alice.id), "owner");
  assert.equal(await owners(orgId), 1, "ownerCount wapas 1");
});

test("ek saath do transfer (do alag members ko) → sirf ek kamyab; ek hi owner", async () => {
  const orgId = await orgWithRoles();
  const [a, b] = await Promise.all([transfer(alice, orgId, mona.id), transfer(alice, orgId, vic.id)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(await owners(orgId), 1);
  assert.equal(await roleOf(orgId, alice.id), "admin");
});
