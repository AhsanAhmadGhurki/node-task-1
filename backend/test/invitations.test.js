// invites ke tests — bhejna (owner/admin), validation, 409, replace, 48h, link ki jaanch, accept (email match, ek dafa,
// parallel), list (tokenHash nahi), cancel, cross-org 404, transaction rollback
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js); emails stub (ctx.sentInvites)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("invitations");

// alice owner, adam admin, mona member, vic viewer (har test ki apni org); bob = Org B ka owner
let alice;
let adam;
let mona;
let vic;
let bob;

const HOURS_48 = 48 * 60 * 60 * 1000;
const Member = () => mongoose.model("OrganizationMember");
const Invitation = () => mongoose.model("Invitation");

const as = (who) => ({
  get: (route) => ctx.request("GET", route, { token: who.token }),
  post: (route, body) => ctx.request("POST", route, { body, token: who.token }),
  delete: (route) => ctx.request("DELETE", route, { token: who.token })
});

const account = async (email) => {
  const { json } = await ctx.verifiedAccount(email);
  return { token: json.token, id: json.user._id, email };
};

let seq = 0;
// har test ke liye naya, abhi tak na bana user (invite ka email) — accept karna ho to account bhi
const freshEmail = () => `guest-${Date.now()}-${(seq += 1)}@example.test`;

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

const invite = (who, orgId, email, role = "member") => as(who).post(`/orgs/${orgId}/invitations`, { email, role });
const accept = (who, token) => as(who).post(`/invitations/${token}/accept`);
const preview = (token) => ctx.request("GET", `/invitations/${token}`);

before(async () => {
  await ctx.start();
  alice = await account("alice-inv@example.test");
  adam = await account("adam-inv@example.test");
  mona = await account("mona-inv@example.test");
  vic = await account("vic-inv@example.test");
  bob = await account("bob-inv@example.test");
});

after(async () => {
  await ctx.stop();
});

// ---------- bhejna ----------

test("1–2. owner aur admin invite bhej sakte hain → 201, email mein link, DB mein sirf hash", async () => {
  const orgId = await orgWithRoles("Acme");
  for (const who of [alice, adam]) {
    const email = freshEmail();
    const res = await invite(who, orgId, `  ${email.toUpperCase()}  `);
    assert.equal(res.status, 201);
    assert.equal(res.json.message, "Invitation sent");
    assert.equal(res.json.invitation.email, email, "trim + lowercase");
    assert.equal(res.json.invitation.status, "pending");
    assert.equal(res.json.invitation.tokenHash, undefined);
    assert.equal(res.json.devToken, undefined, "tests mein EXPOSE_DEV_OTP band");

    const sent = ctx.sentInvites.at(-1);
    assert.equal(sent.email, email);
    assert.equal(sent.orgName, "Acme");
    assert.match(sent.url, /^http:\/\/localhost:5173\/invitations\/[A-Za-z0-9_-]{43}$/);

    // DB mein asal token kahin nahi — sirf us ka SHA-256
    const token = ctx.inviteTokenFor(email);
    const stored = await Invitation().findById(res.json.invitation._id).lean();
    assert.notEqual(stored.tokenHash, token);
    assert.equal(stored.tokenHash, require("node:crypto").createHash("sha256").update(token).digest("hex"));
    assert.ok(!JSON.stringify(stored).includes(token));
  }
});

test("3–4. member aur viewer invite nahi bhej sakte → 403, kuch nahi bana", async () => {
  const orgId = await orgWithRoles();
  for (const who of [mona, vic]) {
    const res = await invite(who, orgId, freshEmail());
    assert.equal(res.status, 403);
    assert.match(res.json.message, /admin role or higher/);
  }
  assert.equal(await Invitation().countDocuments({ org: orgId }), 0);
});

test("5. ghalat email → 400", async () => {
  const orgId = await orgWithRoles();
  for (const email of [undefined, "", "nahi-email", "a@", { $ne: null }]) {
    const res = await invite(alice, orgId, email);
    assert.equal(res.status, 400, JSON.stringify(email));
    assert.equal(res.json.errors[0].field, "email");
  }
});

test("6. ghalat role → 400 (owner bhi); admin kisi ko admin bana ke nahi bula sakta → 403", async () => {
  const orgId = await orgWithRoles();
  for (const role of ["owner", "superadmin", "ADMIN", 1]) {
    const res = await invite(alice, orgId, freshEmail(), role);
    assert.equal(res.status, 400, String(role));
    assert.equal(res.json.errors.find((e) => e.field === "role").field, "role");
  }
  assert.equal((await invite(alice, orgId, freshEmail(), "owner")).json.message, "Role must be one of: admin, member, viewer");
  // role bheja hi nahi (invite() ka default "member" nahi chahiye — seedha request)
  const missing = await as(alice).post(`/orgs/${orgId}/invitations`, { email: freshEmail() });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.message, "Role is required");
  const res = await invite(adam, orgId, freshEmail(), "admin");
  assert.equal(res.status, 403);
  assert.equal(res.json.message, "Your role (admin) can't invite someone as admin");
  // owner admin bula sakta hai
  assert.equal((await invite(alice, orgId, freshEmail(), "admin")).status, 201);
});

test("7. jo email pehle se member hai → 409 (case alag ho to bhi)", async () => {
  const orgId = await orgWithRoles();
  const res = await invite(alice, orgId, mona.email.toUpperCase());
  assert.equal(res.status, 409);
  assert.equal(res.json.message, "This email already belongs to a member of this organization");
  assert.equal(await Invitation().countDocuments({ org: orgId }), 0);
});

test("8–9. pending email ko dobara invite → naya token, purana 'replaced' aur band (410); naya chalta hai", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  const first = await invite(alice, orgId, email, "viewer");
  const oldToken = ctx.inviteTokenFor(email);

  const second = await invite(adam, orgId, email, "member");
  assert.equal(second.status, 201);
  assert.match(second.json.message, /previous link no longer works/);
  const newToken = ctx.inviteTokenFor(email);
  assert.notEqual(newToken, oldToken);

  assert.equal((await Invitation().findById(first.json.invitation._id)).status, "replaced");
  assert.equal(await Invitation().countDocuments({ org: orgId, email, status: "pending" }), 1);

  const old = await preview(oldToken);
  assert.equal(old.status, 410);
  assert.match(old.json.message, /newer invitation/);

  const guest = await account(email);
  assert.equal((await accept(guest, oldToken)).status, 410, "purana token accept bhi nahi");
  const ok = await accept(guest, newToken);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.role, "member", "naye invite ka role");
});

test("10. invite banne ke theek 48 ghante baad expire hota hai", async () => {
  const orgId = await orgWithRoles();
  const before = Date.now();
  const res = await invite(alice, orgId, freshEmail());
  const after = Date.now();
  const expiresAt = new Date(res.json.invitation.expiresAt).getTime();
  assert.ok(expiresAt >= before + HOURS_48 && expiresAt <= after + HOURS_48);
  assert.equal(expiresAt - new Date(res.json.invitation.createdAt).getTime(), HOURS_48);
});

// ---------- link ki jaanch ----------

test("GET /invitations/:token — chalta link: org ka naam, role, email; tokenHash/ids nahi; sirf API key", async () => {
  const orgId = await orgWithRoles("Preview Org");
  const email = freshEmail();
  await invite(alice, orgId, email, "viewer");
  const res = await preview(ctx.inviteTokenFor(email));
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.json.invitation).sort(), ["email", "expiresAt", "invitedBy", "org", "role"]);
  assert.deepEqual(res.json.invitation.org, { name: "Preview Org" });
  assert.equal(res.json.invitation.role, "viewer");
  assert.ok(!res.text.includes("tokenHash"));
  assert.equal((await ctx.request("GET", `/invitations/${ctx.inviteTokenFor(email)}`, { apiKey: null })).status, 401);
});

test("11. ghalat / anjaan token → 404 (jaanch aur accept dono)", async () => {
  const guest = await account(freshEmail());
  for (const token of ["abc", "x".repeat(43), "A".repeat(42) + "!", require("node:crypto").randomBytes(32).toString("base64url")]) {
    const res = await preview(token);
    assert.equal(res.status, 404, token);
    assert.deepEqual(res.json, { message: "Invitation not found" });
    assert.equal((await accept(guest, token)).status, 404);
  }
});

test("12. expire hua token → 410 (jaanch aur accept), membership nahi bani", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  const res = await invite(alice, orgId, email);
  await Invitation().updateOne({ _id: res.json.invitation._id }, { expiresAt: new Date(Date.now() - 1000) });
  const token = ctx.inviteTokenFor(email);

  const check = await preview(token);
  assert.equal(check.status, 410);
  assert.match(check.json.message, /expired/);

  const guest = await account(email);
  assert.equal((await accept(guest, token)).status, 410);
  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 0);
});

// ---------- accept ----------

test("13. doosre email se logged-in user → 403, invite pending hi rehta hai", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  const token = ctx.inviteTokenFor(email);

  const res = await accept(bob, token);
  assert.equal(res.status, 403);
  assert.equal(res.json.message, "This invitation was sent to a different email address. Log in with that email to accept it.");
  assert.equal(await Member().countDocuments({ org: orgId, user: bob.id }), 0);
  assert.equal((await Invitation().findOne({ org: orgId, email })).status, "pending");
});

test("accept — login ke bina 401", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  assert.equal((await ctx.request("POST", `/invitations/${ctx.inviteTokenFor(email)}/accept`)).status, 401);
});

test("14. sahi email → 200, invite wale role mein member, invite 'accepted'; ab org dikhti hai", async () => {
  const orgId = await orgWithRoles("Join Me");
  const email = freshEmail();
  await invite(alice, orgId, email, "viewer");
  const guest = await account(email);

  const res = await accept(guest, ctx.inviteTokenFor(email));
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "Invitation accepted");
  assert.equal(res.json.org.name, "Join Me");
  assert.equal(res.json.role, "viewer");

  const inv = await Invitation().findOne({ org: orgId, email });
  assert.equal(inv.status, "accepted");
  assert.ok(inv.acceptedAt);
  assert.equal(String(inv.acceptedBy), guest.id);
  assert.equal((await as(guest).get(`/orgs/${orgId}`)).json.role, "viewer");
  // owner nahi bana — ownerCount waisa hi
  assert.equal((await mongoose.model("Organization").findById(orgId)).ownerCount, 1);
});

test("15. accept hua invite dobara → 409 (jaanch bhi 409), koi doosri membership nahi", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  const guest = await account(email);
  const token = ctx.inviteTokenFor(email);
  assert.equal((await accept(guest, token)).status, 200);

  const again = await accept(guest, token);
  assert.equal(again.status, 409);
  assert.equal(again.json.message, "This invitation has already been accepted");
  assert.equal((await preview(token)).status, 409);

  // member ne org chhodi — wahi purana link phir bhi nahi chalta
  await Member().deleteOne({ org: orgId, user: guest.id });
  assert.equal((await accept(guest, token)).status, 409);
  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 0);
});

test("16. duplicate membership nahi — invite ke baad koi aur raaste se member ban gaya → accept 409", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  const guest = await account(email);
  await Member().create({ org: orgId, user: guest.id, role: "viewer" });

  const res = await accept(guest, ctx.inviteTokenFor(email));
  assert.equal(res.status, 409);
  assert.equal(res.json.message, "You are already a member of this organization");
  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 1);
  // ab dobara invite karna bhi 409 (member hai)
  assert.equal((await invite(alice, orgId, email)).status, 409);
});

test("21. ek hi link se ek saath kai accept → sirf ek kamyab, ek hi membership", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  const guest = await account(email);
  const token = ctx.inviteTokenFor(email);

  const results = await Promise.all([1, 2, 3, 4].map(() => accept(guest, token)));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409, 409, 409]);
  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 1);
  assert.equal((await Invitation().findOne({ org: orgId, email })).status, "accepted");
});

test("20. transaction rollback — membership ban chuki, invite 'accepted' karte waqt galti → 500, kuch nahi badla", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  const guest = await account(email);
  const token = ctx.inviteTokenFor(email);

  const original = Invitation().updateOne;
  Invitation().updateOne = async () => {
    throw new Error("simulated DB failure");
  };
  try {
    const res = await accept(guest, token);
    assert.equal(res.status, 500);
    assert.deepEqual(res.json, { message: "Internal Server Error" });
  } finally {
    Invitation().updateOne = original;
  }

  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 0, "membership wapas");
  assert.equal((await Invitation().findOne({ org: orgId, email })).status, "pending");
  // galti hatne ke baad wahi link kaam karta hai
  assert.equal((await accept(guest, token)).status, 200);
});

// ---------- list + cancel ----------

test("19. list — pending invites, expired flag, invitedBy ka naam/email; tokenHash kabhi nahi; accepted/replaced nahi", async () => {
  const orgId = await orgWithRoles();
  const pending = freshEmail();
  const replacedEmail = freshEmail();
  const acceptedEmail = freshEmail();
  await invite(alice, orgId, pending);
  await invite(alice, orgId, replacedEmail);
  await invite(alice, orgId, replacedEmail);
  await invite(alice, orgId, acceptedEmail);
  await accept(await account(acceptedEmail), ctx.inviteTokenFor(acceptedEmail));

  for (const who of [alice, adam, mona, vic]) {
    const res = await as(who).get(`/orgs/${orgId}/invitations`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.invitations.map((i) => i.email).sort(), [pending, replacedEmail].sort());
    assert.ok(!res.text.includes("tokenHash"));
    assert.ok(res.json.invitations.every((i) => i.status === "pending" && i.expired === false));
    assert.equal(res.json.invitations[0].invitedBy.email, alice.email);
  }
});

test("18. cancel — owner/admin → 200 aur link band; member/viewer → 403", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  const { json } = await invite(alice, orgId, email);
  const id = json.invitation._id;

  for (const who of [mona, vic]) {
    assert.equal((await as(who).delete(`/orgs/${orgId}/invitations/${id}`)).status, 403);
  }
  assert.ok(await Invitation().findById(id));

  const res = await as(adam).delete(`/orgs/${orgId}/invitations/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.invitation.tokenHash, undefined);
  assert.equal((await preview(ctx.inviteTokenFor(email))).status, 404, "cancel ke baad link nahi chalta");
  assert.equal((await as(alice).delete(`/orgs/${orgId}/invitations/${id}`)).status, 404, "dobara cancel 404");
});

test("17. cross-org — Org B ka owner Org A ke invites na dekh, na bhej, na cancel kar sake → 404; apni org se doosri org ka invite id bhi 404", async () => {
  const orgA = await orgWithRoles("Org A");
  const { json } = await invite(alice, orgA, freshEmail());
  const inviteA = json.invitation._id;

  for (const res of [
    await as(bob).get(`/orgs/${orgA}/invitations`),
    await invite(bob, orgA, freshEmail()),
    await invite(bob, orgA, "ghalat-email", "owner"),
    await as(bob).delete(`/orgs/${orgA}/invitations/${inviteA}`)
  ]) {
    assert.equal(res.status, 404);
    assert.deepEqual(res.json, { message: "Organization not found" });
  }

  // bob apni Org B ke raaste se Org A ka invite id cancel kare — 404, Org A ka invite salamat
  const orgB = (await as(bob).post("/orgs", { name: "Org B" })).json.org._id;
  const viaOwnOrg = await as(bob).delete(`/orgs/${orgB}/invitations/${inviteA}`);
  assert.equal(viaOwnOrg.status, 404);
  assert.deepEqual(viaOwnOrg.json, { message: "Invitation not found" });
  assert.equal((await Invitation().findById(inviteA)).status, "pending");
  for (const id of ["abc", new mongoose.Types.ObjectId().toString()]) {
    assert.equal((await as(alice).delete(`/orgs/${orgA}/invitations/${id}`)).status, 404);
  }
});

test("member ne org chhodi → dobara invite ho sakta hai (purana accepted invite rukawat nahi)", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  const guest = await account(email);
  await accept(guest, ctx.inviteTokenFor(email));
  assert.equal((await as(guest).post(`/orgs/${orgId}/leave`)).status, 200);

  assert.equal((await invite(alice, orgId, email)).status, 201);
  assert.equal((await accept(guest, ctx.inviteTokenFor(email))).status, 200);
});

test("org delete — us ke saare invites (pending/accepted) mit jate hain, link 404", async () => {
  const orgId = await orgWithRoles();
  const email = freshEmail();
  await invite(alice, orgId, email);
  assert.equal((await as(alice).delete(`/orgs/${orgId}`)).status, 200);
  assert.equal(await Invitation().countDocuments({ org: orgId }), 0);
  assert.equal((await preview(ctx.inviteTokenFor(email))).status, 404);
});

test("devToken sirf development — NODE_ENV=production mein EXPOSE_DEV_OTP=true par server start hi nahi hota, aur config band rakhta hai", () => {
  const path = require("node:path");
  const { execFileSync } = require("node:child_process");
  const validateEnv = require(path.join(__dirname, "..", "src", "config", "validateEnv"));
  const base = { MONGO_URI: "mongodb://127.0.0.1:27017/x", API_KEY: "k".repeat(32), JWT_SECRET: "s".repeat(32), SMTP_USER: "u", SMTP_PASS: "p" };

  assert.ok(validateEnv({ ...base, NODE_ENV: "production", EXPOSE_DEV_OTP: "true" }).some((e) => /EXPOSE_DEV_OTP must not be true/.test(e)));
  assert.deepEqual(validateEnv({ ...base, EXPOSE_DEV_OTP: "true" }), [], "development mein theek");

  // validateEnv chhoot bhi jaye to config khud production mein band rakhta hai (naye process mein, taaza env ke saath)
  const read = (env) =>
    execFileSync(process.execPath, ["-e", `process.stdout.write(String(require(${JSON.stringify(path.join(__dirname, "..", "src", "config"))}).exposeDevOtp))`], {
      env: { PATH: process.env.PATH, ...env }
    }).toString();
  assert.equal(read({ NODE_ENV: "production", EXPOSE_DEV_OTP: "true" }), "false");
  assert.equal(read({ EXPOSE_DEV_OTP: "true" }), "true");
});

// ---------- received (mujhe aaye invites) ----------

const received = (who) => as(who).get("/invitations");
const acceptReceived = (who, id) => as(who).post(`/invitations/received/${id}/accept`);
const declineReceived = (who, id) => as(who).post(`/invitations/received/${id}/decline`);

test("received — sirf mere email ke pending invites (har org ke); expired/replaced/accepted/doosre ke nahi; tokenHash nahi", async () => {
  const email = freshEmail();
  const guest = await account(email);
  const orgA = await orgWithRoles("Recv A");
  const orgB = (await as(bob).post("/orgs", { name: "Recv B" })).json.org._id;

  await invite(alice, orgA, email, "viewer");
  await invite(bob, orgB, email, "admin");
  // doosre ka invite — list mein nahi aana chahiye
  await invite(alice, orgA, freshEmail());
  // expired
  const orgC = (await as(bob).post("/orgs", { name: "Recv C" })).json.org._id;
  const old = await invite(bob, orgC, email);
  await Invitation().updateOne({ _id: old.json.invitation._id }, { expiresAt: new Date(Date.now() - 1000) });

  const res = await received(guest);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.invitations.map((i) => i.org.name).sort(), ["Recv A", "Recv B"]);
  assert.ok(res.json.invitations.every((i) => i.email === email && i.status === "pending"));
  assert.equal(res.json.invitations.find((i) => i.org.name === "Recv B").invitedBy.email, bob.email);
  assert.ok(!res.text.includes("tokenHash"));
  assert.equal((await ctx.request("GET", "/invitations")).status, 401);
});

test("received accept — token ke bina id se → member; dobara 409; kisi aur ka invite id → 404", async () => {
  const email = freshEmail();
  const guest = await account(email);
  const orgId = await orgWithRoles("Recv Accept");
  const { json } = await invite(alice, orgId, email, "member");
  const id = json.invitation._id;

  // bob ka email alag — us ke liye yeh invite "hai hi nahi"
  const other = await acceptReceived(bob, id);
  assert.equal(other.status, 404);
  assert.deepEqual(other.json, { message: "Invitation not found" });

  const ok = await acceptReceived(guest, id);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.role, "member");
  assert.equal(ok.json.org.name, "Recv Accept");
  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 1);
  assert.equal((await acceptReceived(guest, id)).status, 409);
  assert.equal((await received(guest)).json.invitations.length, 0, "accept ke baad list khaali");
  assert.equal((await acceptReceived(guest, "abc")).status, 404);
});

test("received accept — expire hua → 410; replaced → 410", async () => {
  const email = freshEmail();
  const guest = await account(email);
  const orgId = await orgWithRoles();
  const first = await invite(alice, orgId, email);
  await invite(alice, orgId, email);
  assert.equal((await acceptReceived(guest, first.json.invitation._id)).status, 410, "replaced");

  const current = await Invitation().findOne({ org: orgId, email, status: "pending" });
  await Invitation().updateOne({ _id: current._id }, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await acceptReceived(guest, String(current._id))).status, 410, "expired");
  assert.equal(await Member().countDocuments({ org: orgId, user: guest.id }), 0);
});

test("received decline — mera invite mit jaata hai aur link band; kisi aur ka → 404", async () => {
  const email = freshEmail();
  const guest = await account(email);
  const orgId = await orgWithRoles();
  const { json } = await invite(alice, orgId, email);
  const id = json.invitation._id;
  const token = ctx.inviteTokenFor(email);

  assert.equal((await declineReceived(bob, id)).status, 404);
  assert.ok(await Invitation().findById(id));

  const res = await declineReceived(guest, id);
  assert.equal(res.status, 200);
  assert.equal(res.json.message, "Invitation declined");
  assert.equal(await Invitation().findById(id), null);
  assert.equal((await preview(token)).status, 404, "link bhi band");
  assert.equal((await declineReceived(guest, id)).status, 404);
});
