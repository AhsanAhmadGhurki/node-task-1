// orgs ke tests — org banana (banane wala owner), meri orgs, Org B ki isolation (404), aur requireRole ka rank (403)
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const path = require("node:path");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("orgs");

let alice;
let bob;
// har role ke liye ek alag user — admin, member, viewer
let adam;
let mona;
let vic;

const as = (who) => ({
  get: (route) => ctx.request("GET", route, { token: who.token }),
  post: (route, body) => ctx.request("POST", route, { body, token: who.token }),
  patch: (route, body) => ctx.request("PATCH", route, { body, token: who.token }),
  delete: (route) => ctx.request("DELETE", route, { token: who.token })
});

const account = async (email) => {
  const { json } = await ctx.verifiedAccount(email);
  return { token: json.token, id: json.user._id };
};

// alice ki nayi org, jis mein adam admin, mona member, vic viewer — invite flow abhi nahi, is liye seedha DB mein
async function orgWithRoles(name) {
  const { json } = await as(alice).post("/orgs", { name });
  const orgId = json.org._id;
  await mongoose.model("OrganizationMember").insertMany([
    { org: orgId, user: adam.id, role: "admin" },
    { org: orgId, user: mona.id, role: "member" },
    { org: orgId, user: vic.id, role: "viewer" }
  ]);
  return orgId;
}

before(async () => {
  await ctx.start();
  alice = await account("alice-org@example.test");
  bob = await account("bob-org@example.test");
  adam = await account("adam-org@example.test");
  mona = await account("mona-org@example.test");
  vic = await account("vic-org@example.test");
});

after(async () => {
  await ctx.stop();
});

test("org banana → 201, banane wala owner, ownerCount 1, membership DB mein", async () => {
  const res = await as(alice).post("/orgs", { name: "  Alice Team  " });
  assert.equal(res.status, 201);
  assert.equal(res.json.org.name, "Alice Team");
  assert.equal(res.json.role, "owner");
  assert.equal(res.json.org.ownerCount, 1);

  const membership = await mongoose.model("OrganizationMember").findOne({ org: res.json.org._id, user: alice.id });
  assert.equal(membership.role, "owner");
});

test("naam ki validation — khaali, chhota, lamba, string nahi → 400 { message, errors }", async () => {
  for (const name of [undefined, "", " a ", "x".repeat(101)]) {
    const res = await as(alice).post("/orgs", { name });
    assert.equal(res.status, 400, String(name));
    assert.equal(res.json.errors[0].field, "name");
  }
  assert.equal((await as(alice).post("/orgs", { name: { $ne: null } })).json.message, "Name must be a string");
});

test("bina token 401 — org routes par auth hamesha", async () => {
  assert.equal((await ctx.request("GET", "/orgs")).status, 401);
  assert.equal((await ctx.request("POST", "/orgs", { body: { name: "Koi" } })).status, 401);
});

test("GET /orgs — sirf meri orgs, har ek mein mera role", async () => {
  await as(bob).post("/orgs", { name: "Bob Ki Org" });
  const res = await as(alice).get("/orgs");
  assert.equal(res.status, 200);
  const names = res.json.orgs.map((o) => o.name);
  assert.ok(names.includes("Alice Team"));
  assert.ok(!names.includes("Bob Ki Org"), "doosre ki org list mein nahi");
  assert.ok(res.json.orgs.every((o) => o.role === "owner"));
});

test("GET /orgs/:orgId — member ko 200 + role", async () => {
  const { json } = await as(alice).post("/orgs", { name: "Detail Org" });
  const res = await as(alice).get(`/orgs/${json.org._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.org.name, "Detail Org");
  assert.equal(res.json.role, "owner");
});

test("isolation — Org B ka member nahi: asli id, na-maujood id, ghalat shakal, sab ek jaisa 404", async () => {
  const { json } = await as(alice).post("/orgs", { name: "Secret Org" });
  const real = await as(bob).get(`/orgs/${json.org._id}`);
  const missing = await as(bob).get(`/orgs/${new mongoose.Types.ObjectId()}`);
  const malformed = await as(bob).get("/orgs/not-an-id");

  for (const res of [real, missing, malformed]) {
    assert.equal(res.status, 404);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }
});

test("requireRole — rank: chhota role 403, barabar ya upar wala aage; non-member 404", async () => {
  const requireRole = require(path.join(__dirname, "..", "src", "middleware", "requireRole"));
  const { json } = await as(alice).post("/orgs", { name: "Rank Org" });
  const orgId = json.org._id;
  // bob ko seedha member bana do (invite flow abhi nahi)
  await mongoose.model("OrganizationMember").create({ org: orgId, user: bob.id, role: "member" });

  // middleware ko seedha chalao — next(err) ka nateeja pakdo
  const run = async (minRole, userId) => {
    const req = { params: { orgId }, user: { id: userId } };
    let passed;
    await requireRole(minRole)(req, {}, (err) => {
      passed = err || null;
    });
    return { error: passed, membership: req.membership };
  };

  const member = await run("member", bob.id);
  assert.equal(member.error, null);
  assert.deepEqual(member.membership, { orgId, role: "member" });

  assert.equal((await run("viewer", bob.id)).error, null, "member viewer se upar");

  const tooLow = await run("admin", bob.id);
  assert.equal(tooLow.error.statusCode, 403);
  assert.match(tooLow.error.message, /admin role or higher \(your role: member\)/);

  assert.equal((await run("owner", alice.id)).error, null);

  const outsider = await run("viewer", new mongoose.Types.ObjectId().toString());
  assert.equal(outsider.error.statusCode, 404);
});

test("requireRole ka ghalat role naam — foran throw (typo chupke se sab ko ijazat na de)", () => {
  const requireRole = require(path.join(__dirname, "..", "src", "middleware", "requireRole"));
  assert.throws(() => requireRole("admn"), /unknown role "admn"/);
});

// ---------- PATCH /orgs/:orgId (rename) ----------

test("rename — owner aur admin → 200, naya naam (trim) response aur DB mein", async () => {
  const orgId = await orgWithRoles("Rename Org");

  const byOwner = await as(alice).patch(`/orgs/${orgId}`, { name: "  Owner Ka Naam  " });
  assert.equal(byOwner.status, 200);
  assert.equal(byOwner.json.org.name, "Owner Ka Naam");

  const byAdmin = await as(adam).patch(`/orgs/${orgId}`, { name: "Admin Ka Naam" });
  assert.equal(byAdmin.status, 200);
  assert.equal(byAdmin.json.org.name, "Admin Ka Naam");
  assert.equal((await mongoose.model("Organization").findById(orgId)).name, "Admin Ka Naam");
});

test("rename — member aur viewer → 403, naam nahi badla", async () => {
  const orgId = await orgWithRoles("Locked Name");
  for (const who of [mona, vic]) {
    const res = await as(who).patch(`/orgs/${orgId}`, { name: "Hack" });
    assert.equal(res.status, 403);
    assert.match(res.json.message, /admin role or higher/);
  }
  assert.equal((await mongoose.model("Organization").findById(orgId)).name, "Locked Name");
});

test("rename — khaali / sirf spaces / chhota / lamba naam → 400", async () => {
  const orgId = await orgWithRoles("Valid Org");
  for (const name of [undefined, "", "   ", "a", "x".repeat(101)]) {
    const res = await as(alice).patch(`/orgs/${orgId}`, { name });
    assert.equal(res.status, 400, String(name));
    assert.equal(res.json.errors[0].field, "name");
  }
});

test("rename — doosri org (Org B), na-maujood ya ghalat id → 404; ghalat naam par bhi 404 (400 nahi)", async () => {
  const orgId = await orgWithRoles("Alice Private");
  for (const id of [orgId, new mongoose.Types.ObjectId().toString(), "abc"]) {
    const res = await as(bob).patch(`/orgs/${id}`, { name: "Bob Ka" });
    assert.equal(res.status, 404, id);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }
  // validation se pehle membership — non-member ko 400 nahi, warna org ka hona khul jaata
  assert.equal((await as(bob).patch(`/orgs/${orgId}`, { name: "" })).status, 404);
  assert.equal((await mongoose.model("Organization").findById(orgId)).name, "Alice Private");
});

// ---------- DELETE /orgs/:orgId ----------

const Org = () => mongoose.model("Organization");
const Member = () => mongoose.model("OrganizationMember");
const Invitation = () => mongoose.model("Invitation");

// invitations abhi API se nahi bante — test ke liye seedha DB mein
async function addInvitation(orgId, email) {
  await Invitation().create({
    org: orgId,
    email,
    role: "member",
    tokenHash: require("node:crypto").randomBytes(32).toString("hex"),
    invitedBy: alice.id,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
  });
}

test("delete — admin, member, viewer → 403; org salamat", async () => {
  const orgId = await orgWithRoles("Delete Guard");
  for (const who of [adam, mona, vic]) {
    const res = await as(who).delete(`/orgs/${orgId}`);
    assert.equal(res.status, 403);
    assert.match(res.json.message, /owner role or higher/);
  }
  assert.ok(await Org().findById(orgId));
  assert.equal(await Member().countDocuments({ org: orgId }), 4);
});

test("delete — owner → 200; org, saari memberships aur invitations mit gayin; doosri org salamat", async () => {
  const orgId = await orgWithRoles("Delete Me");
  await addInvitation(orgId, "pending@example.test");
  const otherId = await orgWithRoles("Keep Me");
  await addInvitation(otherId, "pending@example.test");

  const res = await as(alice).delete(`/orgs/${orgId}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "Organization deleted");
  assert.deepEqual(res.json.deleted, { members: 4, invitations: 1 });

  assert.equal(await Org().findById(orgId), null);
  assert.equal(await Member().countDocuments({ org: orgId }), 0);
  assert.equal(await Invitation().countDocuments({ org: orgId }), 0);

  // same email ka invite aur same members doosri org mein — un par koi asar nahi
  assert.ok(await Org().findById(otherId));
  assert.equal(await Member().countDocuments({ org: otherId }), 4);
  assert.equal(await Invitation().countDocuments({ org: otherId }), 1);

  // mitne ke baad org ke purane member ko bhi 404
  assert.equal((await as(adam).get(`/orgs/${orgId}`)).status, 404);
  assert.equal((await as(alice).delete(`/orgs/${orgId}`)).status, 404);
});

test("delete — Org A ka user Org B delete nahi kar sakta → 404, Org B salamat", async () => {
  const orgB = (await as(bob).post("/orgs", { name: "Bob Org B" })).json.org._id;
  for (const id of [orgB, new mongoose.Types.ObjectId().toString(), "bad-id"]) {
    const res = await as(alice).delete(`/orgs/${id}`);
    assert.equal(res.status, 404, id);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }
  assert.ok(await Org().findById(orgB));
  assert.equal(await Member().countDocuments({ org: orgB }), 1);
});

test("delete — transaction beech mein fail (invitations par galti) → 500, org aur memberships waise hi (partial delete nahi)", async () => {
  const orgId = await orgWithRoles("Rollback Org");
  await addInvitation(orgId, "stay@example.test");

  // org aur members mit chuke honge jab ye chalega — transaction na hoti to aadhi mitti org bachti
  const original = Invitation().deleteMany;
  Invitation().deleteMany = async () => {
    throw new Error("simulated DB failure");
  };
  try {
    const res = await as(alice).delete(`/orgs/${orgId}`);
    assert.equal(res.status, 500);
    assert.deepEqual(res.json, { message: "Internal Server Error" });
  } finally {
    Invitation().deleteMany = original;
  }

  assert.ok(await Org().findById(orgId), "org wapas");
  assert.equal(await Member().countDocuments({ org: orgId }), 4, "memberships wapas");
  assert.equal(await Invitation().countDocuments({ org: orgId }), 1, "invitation salamat");

  // galti hatne ke baad wahi delete kaam karta hai
  assert.equal((await as(alice).delete(`/orgs/${orgId}`)).status, 200);
});
