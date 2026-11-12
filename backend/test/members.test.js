// org members ke tests — list, details, role badalna, nikalna, chhodna, aakhri owner, ownerCount, transaction rollback
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("members");

// alice owner, adam admin, mona member, vic viewer (har test ki apni nayi org); bob = doosri org (Org B) ka owner
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
  patch: (route, body) => ctx.request("PATCH", route, { body, token: who.token }),
  delete: (route) => ctx.request("DELETE", route, { token: who.token })
});

const account = async (email) => {
  const { json } = await ctx.verifiedAccount(email);
  return { token: json.token, id: json.user._id, email };
};

// alice ki nayi org — adam admin, mona member, vic viewer (invite flow abhi nahi, is liye seedha DB mein)
async function orgWithRoles(name = "Team") {
  const { json } = await as(alice).post("/orgs", { name });
  const orgId = json.org._id;
  await Member().insertMany([
    { org: orgId, user: adam.id, role: "admin" },
    { org: orgId, user: mona.id, role: "member" },
    { org: orgId, user: vic.id, role: "viewer" }
  ]);
  return orgId;
}

// ownerCount hamesha asli owners ki ginti ke barabar ho
async function assertOwnerCountConsistent(orgId) {
  const org = await Org().findById(orgId);
  const owners = await Member().countDocuments({ org: orgId, role: "owner" });
  assert.equal(org.ownerCount, owners, "ownerCount === owner memberships");
  return owners;
}

const roleOf = async (orgId, userId) => (await Member().findOne({ org: orgId, user: userId }))?.role;

before(async () => {
  await ctx.start();
  alice = await account("alice-mem@example.test");
  adam = await account("adam-mem@example.test");
  mona = await account("mona-mem@example.test");
  vic = await account("vic-mem@example.test");
  bob = await account("bob-mem@example.test");
});

after(async () => {
  await ctx.stop();
});

// ---------- Part A: list + details ----------

test("list — har role (viewer bhi) dekh sakta hai; owners pehle; sirf ghair-hassas user fields", async () => {
  const orgId = await orgWithRoles();
  for (const who of [alice, adam, mona, vic]) {
    const res = await as(who).get(`/orgs/${orgId}/members`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.members.map((m) => m.role), ["owner", "admin", "member", "viewer"]);
  }

  const { json } = await as(vic).get(`/orgs/${orgId}/members`);
  const owner = json.members[0];
  assert.equal(owner.user.email, alice.email);
  assert.ok(owner.joinedAt);
  for (const secret of ["password", "failedLoginAttempts", "lockUntil", "isVerified"]) {
    assert.equal(owner.user[secret], undefined, secret);
  }
});

test("details — isi org ka member → 200; doosri org ka user, anjaan ya ghalat id → 404 Member not found", async () => {
  const orgId = await orgWithRoles();
  const res = await as(vic).get(`/orgs/${orgId}/members/${mona.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.member.user.email, mona.email);
  assert.equal(res.json.member.role, "member");

  // bob asli user hai lekin is org mein nahi
  for (const id of [bob.id, new mongoose.Types.ObjectId().toString(), "nahi-hai"]) {
    const missing = await as(alice).get(`/orgs/${orgId}/members/${id}`);
    assert.equal(missing.status, 404, id);
    assert.deepEqual(missing.json, { message: "Member not found" });
  }
});

test("cross-org — Org B ka owner Org A ke members ki list/details nahi dekh sakta → 404 Organization not found", async () => {
  const orgId = await orgWithRoles();
  for (const route of [`/orgs/${orgId}/members`, `/orgs/${orgId}/members/${alice.id}`]) {
    const res = await as(bob).get(route);
    assert.equal(res.status, 404, route);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }
});

// ---------- Part B: role badalna ----------

const setRole = (who, orgId, userId, role) => as(who).patch(`/orgs/${orgId}/members/${userId}/role`, { role });
const remove = (who, orgId, userId) => as(who).delete(`/orgs/${orgId}/members/${userId}`);

test("role — owner kisi ka bhi role badal sakta hai; owner banana ownerCount barhata hai", async () => {
  const orgId = await orgWithRoles();
  const res = await setRole(alice, orgId, vic.id, "admin");
  assert.equal(res.status, 200);
  assert.equal(res.json.member.role, "admin");
  assert.equal(res.json.member.user.email, vic.email);

  assert.equal((await setRole(alice, orgId, adam.id, "viewer")).status, 200);
  assert.equal((await setRole(alice, orgId, mona.id, "owner")).status, 200);
  assert.equal(await assertOwnerCountConsistent(orgId), 2);
});

test("role — admin sirf member ↔ viewer; owner/admin ko nahi chhed sakta, kisi ko admin/owner nahi bana sakta → 403", async () => {
  const orgId = await orgWithRoles();
  assert.equal((await setRole(adam, orgId, mona.id, "viewer")).status, 200);
  assert.equal((await setRole(adam, orgId, mona.id, "member")).status, 200);

  const demoteOwner = await setRole(adam, orgId, alice.id, "member");
  assert.equal(demoteOwner.status, 403);
  assert.equal(demoteOwner.json.message, "Your role (admin) can't change the role of an owner");

  for (const role of ["admin", "owner"]) {
    const res = await setRole(adam, orgId, mona.id, role);
    assert.equal(res.status, 403, role);
    assert.equal(res.json.message, `Your role (admin) can't make someone ${role}`);
  }

  // doosra admin bhi nahi
  await Member().updateOne({ org: orgId, user: vic.id }, { role: "admin" });
  assert.equal((await setRole(adam, orgId, vic.id, "member")).status, 403);
  assert.equal(await roleOf(orgId, alice.id), "owner");
  await assertOwnerCountConsistent(orgId);
});

test("role — member aur viewer kisi ka role nahi badal sakte → 403", async () => {
  const orgId = await orgWithRoles();
  for (const who of [mona, vic]) {
    const res = await setRole(who, orgId, vic.id, "member");
    assert.equal(res.status, 403);
    assert.match(res.json.message, /admin role or higher/);
  }
  assert.equal(await roleOf(orgId, vic.id), "viewer");
});

test("role — ghalat role → 400; anjaan member → 404 Member not found; Org B ka user → 404 Organization not found", async () => {
  const orgId = await orgWithRoles();
  for (const role of [undefined, "superadmin", "OWNER", 1]) {
    const res = await setRole(alice, orgId, mona.id, role);
    assert.equal(res.status, 400, String(role));
    assert.equal(res.json.errors[0].field, "role");
  }

  for (const id of [bob.id, new mongoose.Types.ObjectId().toString(), "abc"]) {
    const res = await setRole(alice, orgId, id, "viewer");
    assert.equal(res.status, 404, id);
    assert.deepEqual(res.json, { message: "Member not found" });
  }

  // bob (Org B) Org A mein kuch nahi badal sakta — ghalat role par bhi 404, 400 nahi
  for (const role of ["viewer", "superadmin"]) {
    const res = await setRole(bob, orgId, mona.id, role);
    assert.equal(res.status, 404);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }
  assert.equal(await roleOf(orgId, mona.id), "member");
});

test("role — aakhri owner khud ko demote nahi kar sakta (400); doosra owner ho to kar sakta hai", async () => {
  const orgId = await orgWithRoles();
  const last = await setRole(alice, orgId, alice.id, "admin");
  assert.equal(last.status, 400);
  assert.match(last.json.message, /at least one owner/);
  assert.equal(await roleOf(orgId, alice.id), "owner");

  // mona owner bani → ab alice khud ko admin kar sakti hai
  assert.equal((await setRole(alice, orgId, mona.id, "owner")).status, 200);
  assert.equal((await setRole(alice, orgId, alice.id, "admin")).status, 200);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);

  // ab mona aakhri owner
  assert.equal((await setRole(mona, orgId, mona.id, "member")).status, 400);
  await assertOwnerCountConsistent(orgId);
});

test("role — do owners ek saath ek doosre ko demote karein → sirf ek kamyab, org kabhi bina owner nahi", async () => {
  const orgId = await orgWithRoles();
  await setRole(alice, orgId, mona.id, "owner");

  const [a, b] = await Promise.all([setRole(alice, orgId, mona.id, "member"), setRole(mona, orgId, alice.id, "member")]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);
});

test("role — wahi role dobara → 200, ownerCount nahi badla", async () => {
  const orgId = await orgWithRoles();
  assert.equal((await setRole(alice, orgId, alice.id, "owner")).status, 200);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);
});

// ---------- Part B: member nikaalna ----------

test("remove — owner kisi ko bhi; admin sirf member/viewer ko; admin owner/admin ko nahi → 403", async () => {
  const orgId = await orgWithRoles();
  assert.equal((await remove(adam, orgId, vic.id)).status, 200);
  assert.equal(await roleOf(orgId, vic.id), undefined);

  const res = await remove(adam, orgId, alice.id);
  assert.equal(res.status, 403);
  assert.equal(res.json.message, "Your role (admin) can't remove an owner");

  const removed = await remove(alice, orgId, adam.id);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.json.member, { user: adam.id, role: "admin" });
  // nikala gaya admin ab org hi nahi dekh sakta
  assert.equal((await as(adam).get(`/orgs/${orgId}`)).status, 404);
});

test("remove — member aur viewer kisi ko nahi nikaal sakte → 403; khud ko → 400 (leave use karo)", async () => {
  const orgId = await orgWithRoles();
  for (const who of [mona, vic]) {
    assert.equal((await remove(who, orgId, adam.id)).status, 403);
  }
  const self = await remove(alice, orgId, alice.id);
  assert.equal(self.status, 400);
  assert.match(self.json.message, /leave/);
  assert.equal(await Member().countDocuments({ org: orgId }), 4);
});

test("remove — anjaan member 404; Org B ka owner Org A ka member nahi nikaal sakta → 404", async () => {
  const orgId = await orgWithRoles();
  assert.equal((await remove(alice, orgId, bob.id)).status, 404);
  const cross = await remove(bob, orgId, mona.id);
  assert.equal(cross.status, 404);
  assert.deepEqual(cross.json, { message: "Organization not found" });
  assert.equal(await roleOf(orgId, mona.id), "member");
});

test("remove — doosre owner ko nikaalna ownerCount ghatata hai; do owners ek saath ek doosre ko → sirf ek kamyab", async () => {
  const orgId = await orgWithRoles();
  await setRole(alice, orgId, mona.id, "owner");
  assert.equal((await remove(alice, orgId, mona.id)).status, 200);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);

  await setRole(alice, orgId, adam.id, "owner");
  const [a, b] = await Promise.all([remove(alice, orgId, adam.id), remove(adam, orgId, alice.id)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);
});

test("transaction rollback — owner seat chhutne ke baad galti → 500, role aur ownerCount waise hi", async () => {
  const orgId = await orgWithRoles();
  await setRole(alice, orgId, mona.id, "owner");

  // releaseOwnerSeat (ownerCount 2 → 1) ho chuka hoga jab role likhte waqt galti aaye
  const original = Member().updateOne;
  Member().updateOne = async () => {
    throw new Error("simulated DB failure");
  };
  try {
    const res = await setRole(alice, orgId, mona.id, "member");
    assert.equal(res.status, 500);
  } finally {
    Member().updateOne = original;
  }

  assert.equal(await roleOf(orgId, mona.id), "owner");
  assert.equal(await assertOwnerCountConsistent(orgId), 2, "ownerCount wapas 2");
});

// ---------- Part C: org chhodna ----------

const leave = (who, orgId) => as(who).post(`/orgs/${orgId}/leave`);

test("leave — admin, member, viewer chhod sakte hain; phir org 404", async () => {
  const orgId = await orgWithRoles();
  for (const who of [adam, mona, vic]) {
    const res = await leave(who, orgId);
    assert.equal(res.status, 200);
    assert.equal(res.json.message, "You left the organization");
    assert.equal((await as(who).get(`/orgs/${orgId}`)).status, 404);
  }
  assert.equal(await Member().countDocuments({ org: orgId }), 1);
  await assertOwnerCountConsistent(orgId);
});

test("leave — aakhri owner nahi chhod sakta (400); doosra owner ho to chhod sakta hai, ownerCount ghatta hai", async () => {
  const orgId = await orgWithRoles();
  const blocked = await leave(alice, orgId);
  assert.equal(blocked.status, 400);
  assert.equal(blocked.json.message, "You are the last owner. Make another member an owner before leaving the organization.");
  assert.equal(await roleOf(orgId, alice.id), "owner");

  await setRole(alice, orgId, adam.id, "owner");
  assert.equal((await leave(alice, orgId)).status, 200);
  assert.equal(await roleOf(orgId, alice.id), undefined);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);

  // ab adam aakhri owner
  assert.equal((await leave(adam, orgId)).status, 400);
});

test("leave — do owners ek saath chhodein → sirf ek, org kabhi bina owner nahi", async () => {
  const orgId = await orgWithRoles();
  await setRole(alice, orgId, mona.id, "owner");
  const [a, b] = await Promise.all([leave(alice, orgId), leave(mona, orgId)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.equal(await assertOwnerCountConsistent(orgId), 1);
});

test("leave — non-member / doosri org → 404 (koi asar nahi)", async () => {
  const orgId = await orgWithRoles();
  const res = await leave(bob, orgId);
  assert.equal(res.status, 404);
  assert.deepEqual(res.json, { message: "Organization not found" });
  assert.equal(await Member().countDocuments({ org: orgId }), 4);
});

test("leave rollback — owner seat chhutne ke baad galti → 500, membership aur ownerCount waise hi", async () => {
  const orgId = await orgWithRoles();
  await setRole(alice, orgId, mona.id, "owner");
  const original = Member().deleteOne;
  Member().deleteOne = async () => {
    throw new Error("simulated DB failure");
  };
  try {
    assert.equal((await leave(alice, orgId)).status, 500);
  } finally {
    Member().deleteOne = original;
  }
  assert.equal(await roleOf(orgId, alice.id), "owner");
  assert.equal(await assertOwnerCountConsistent(orgId), 2);
});
