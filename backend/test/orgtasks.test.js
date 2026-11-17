// workspace (org) ke tasks — roles, banane wale ka qaida, personal se alag, cross-org, org delete
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("orgtasks");

// alice owner, adam admin, mona member, max member, vic viewer (har test ki apni nayi org); bob kisi org mein nahi
let alice;
let adam;
let mona;
let max;
let vic;
let bob;

const Member = () => mongoose.model("OrganizationMember");
const Task = () => mongoose.model("Task");

const as = (who) => ({
  get: (route) => ctx.request("GET", route, { token: who.token }),
  post: (route, body) => ctx.request("POST", route, { body, token: who.token }),
  put: (route, body) => ctx.request("PUT", route, { body, token: who.token }),
  delete: (route) => ctx.request("DELETE", route, { token: who.token })
});

const account = async (email) => {
  const { json } = await ctx.verifiedAccount(email);
  return { token: json.token, id: json.user._id, email };
};

// alice ki nayi org — roles seedha DB mein (invite flow ke tests alag file mein)
async function orgWithRoles(name = "Team") {
  const { json } = await as(alice).post("/orgs", { name });
  const orgId = json.org._id;
  await Member().insertMany([
    { org: orgId, user: adam.id, role: "admin" },
    { org: orgId, user: mona.id, role: "member" },
    { org: orgId, user: max.id, role: "member" },
    { org: orgId, user: vic.id, role: "viewer" }
  ]);
  return orgId;
}

const createTask = async (who, orgId, title = "Team task") => {
  const res = await as(who).post(`/orgs/${orgId}/tasks`, { title });
  assert.equal(res.status, 201);
  return res.json.task;
};

before(async () => {
  await ctx.start();
  alice = await account("alice-ot@example.test");
  adam = await account("adam-ot@example.test");
  mona = await account("mona-ot@example.test");
  max = await account("max-ot@example.test");
  vic = await account("vic-ot@example.test");
  bob = await account("bob-ot@example.test");
});

after(async () => {
  await ctx.stop();
});

// ---------- banana aur dekhna ----------

test("member task banata hai — banane wala token se (body ka user/org ignore), name/email ke saath", async () => {
  const orgId = await orgWithRoles();
  const res = await as(mona).post(`/orgs/${orgId}/tasks`, { title: "  Write docs  ", user: bob.id, org: "6af5a1c2e9e08289510f9e01" });

  assert.equal(res.status, 201);
  assert.equal(res.json.task.title, "Write docs");
  assert.equal(res.json.task.completed, false);
  assert.equal(res.json.task.org, orgId);
  assert.deepEqual(Object.keys(res.json.task.user).sort(), ["_id", "email", "name"]);
  assert.equal(res.json.task.user._id, mona.id);
});

test("har role list dekh sakta hai (viewer bhi) — purane pehle", async () => {
  const orgId = await orgWithRoles();
  await createTask(alice, orgId, "First");
  await createTask(mona, orgId, "Second");

  for (const who of [alice, adam, mona, vic]) {
    const res = await as(who).get(`/orgs/${orgId}/tasks`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.tasks.map((t) => t.title), ["First", "Second"]);
  }
});

test("viewer task nahi bana sakta, badal nahi sakta, mita nahi sakta — 403", async () => {
  const orgId = await orgWithRoles();
  const task = await createTask(mona, orgId);

  const created = await as(vic).post(`/orgs/${orgId}/tasks`, { title: "Nope" });
  assert.equal(created.status, 403);
  assert.equal(created.json.message, "This action needs the member role or higher (your role: viewer)");
  assert.equal((await as(vic).put(`/orgs/${orgId}/tasks/${task._id}`, { completed: true })).status, 403);
  assert.equal((await as(vic).delete(`/orgs/${orgId}/tasks/${task._id}`)).status, 403);
  assert.equal(await Task().countDocuments({ org: orgId }), 1);
});

test("non-member ko har route 404 — ghalat body par bhi (400 nahi), org ka hona na khule", async () => {
  const orgId = await orgWithRoles();
  const task = await createTask(mona, orgId);

  for (const res of [
    await as(bob).get(`/orgs/${orgId}/tasks`),
    await as(bob).post(`/orgs/${orgId}/tasks`, { title: "" }),
    await as(bob).get(`/orgs/${orgId}/tasks/${task._id}`),
    await as(bob).put(`/orgs/${orgId}/tasks/${task._id}`, {}),
    await as(bob).delete(`/orgs/${orgId}/tasks/${task._id}`)
  ]) {
    assert.equal(res.status, 404);
    assert.equal(res.json.message, "Organization not found");
  }
});

test("validation — personal tasks wale hi qaide", async () => {
  const orgId = await orgWithRoles();
  const task = await createTask(mona, orgId);

  assert.equal((await as(mona).post(`/orgs/${orgId}/tasks`, { title: "   " })).json.message, "Title is required");
  assert.equal((await as(mona).post(`/orgs/${orgId}/tasks`, { title: "x".repeat(201) })).status, 400);
  const notBool = await as(mona).put(`/orgs/${orgId}/tasks/${task._id}`, { completed: "true" });
  assert.equal(notBool.status, 400);
  assert.equal(notBool.json.message, "Completed must be true or false");
  assert.equal((await as(mona).put(`/orgs/${orgId}/tasks/${task._id}`, {})).json.message, "Provide title or completed to update");
});

test("ghalat ya na-maujood task id — 404 'Task not found' (CastError ka 400 nahi)", async () => {
  const orgId = await orgWithRoles();
  for (const id of ["not-an-id", "000000000000000000000000"]) {
    const res = await as(mona).get(`/orgs/${orgId}/tasks/${id}`);
    assert.equal(res.status, 404);
    assert.equal(res.json.message, "Task not found");
  }
});

// ---------- badalna aur mitana: kis ka task ----------

test("done/pending — har member kisi ka bhi task (team ka kaam)", async () => {
  const orgId = await orgWithRoles();
  const task = await createTask(alice, orgId);

  const res = await as(mona).put(`/orgs/${orgId}/tasks/${task._id}`, { completed: true });
  assert.equal(res.status, 200);
  assert.equal(res.json.task.completed, true);
  assert.equal(res.json.task.user._id, alice.id, "banane wala wahi rehta hai");
});

test("naam — member sirf apne task ka; doosre ka 403 aur kuch nahi badalta (completed bhi nahi)", async () => {
  const orgId = await orgWithRoles();
  const own = await createTask(mona, orgId, "Mona's");
  const others = await createTask(max, orgId, "Max's");

  assert.equal((await as(mona).put(`/orgs/${orgId}/tasks/${own._id}`, { title: "Mona's v2" })).json.task.title, "Mona's v2");

  const denied = await as(mona).put(`/orgs/${orgId}/tasks/${others._id}`, { title: "Hijacked", completed: true });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.message, "Your role (member) can only rename tasks you created");
  const unchanged = await Task().findById(others._id);
  assert.equal(unchanged.title, "Max's");
  assert.equal(unchanged.completed, false);
});

test("naam — admin aur owner kisi ka bhi task badal sakte hain", async () => {
  const orgId = await orgWithRoles();
  const task = await createTask(mona, orgId);

  assert.equal((await as(adam).put(`/orgs/${orgId}/tasks/${task._id}`, { title: "By admin" })).status, 200);
  assert.equal((await as(alice).put(`/orgs/${orgId}/tasks/${task._id}`, { title: "By owner" })).json.task.title, "By owner");
});

test("mitana — member sirf apna (doosre ka 403); admin/owner kisi ka bhi", async () => {
  const orgId = await orgWithRoles();
  const monas = await createTask(mona, orgId);
  const maxes = await createTask(max, orgId);
  const alices = await createTask(alice, orgId);

  const denied = await as(mona).delete(`/orgs/${orgId}/tasks/${maxes._id}`);
  assert.equal(denied.status, 403);
  assert.equal(denied.json.message, "Your role (member) can only delete tasks you created");

  const own = await as(mona).delete(`/orgs/${orgId}/tasks/${monas._id}`);
  assert.equal(own.status, 200);
  assert.equal(own.json.message, "Task deleted");
  assert.equal((await as(adam).delete(`/orgs/${orgId}/tasks/${maxes._id}`)).status, 200);
  assert.equal((await as(alice).delete(`/orgs/${orgId}/tasks/${alices._id}`)).status, 200);
  assert.equal(await Task().countDocuments({ org: orgId }), 0);
  assert.equal((await as(alice).get(`/orgs/${orgId}/tasks/${monas._id}`)).status, 404);
});

// ---------- personal se alag, aur org se org alag ----------

test("org ka task personal routes (/tasks) se na dikhe na badle; personal task org route se na mile", async () => {
  const orgId = await orgWithRoles();
  const orgTask = await createTask(mona, orgId);
  const personal = (await as(mona).post("/tasks", { title: "Personal" })).json;
  assert.equal(personal.org, null);

  const list = await as(mona).get("/tasks");
  assert.deepEqual(list.json.map((t) => t._id), [personal._id]);
  assert.equal((await as(mona).get(`/tasks/${orgTask._id}`)).status, 404);
  assert.equal((await as(mona).put(`/tasks/${orgTask._id}`, { title: "Moved" })).status, 404);
  assert.equal((await as(mona).delete(`/tasks/${orgTask._id}`)).status, 404);
  assert.equal((await Task().findById(orgTask._id)).title, "Team task");

  const orgList = await as(mona).get(`/orgs/${orgId}/tasks`);
  assert.deepEqual(orgList.json.tasks.map((t) => t._id), [orgTask._id]);
  assert.equal((await as(mona).get(`/orgs/${orgId}/tasks/${personal._id}`)).status, 404);
  assert.equal((await as(mona).delete(`/orgs/${orgId}/tasks/${personal._id}`)).status, 404);
});

test("purana task (org field hi nahi) personal hi gina jaata hai", async () => {
  const legacy = await Task().collection.insertOne({ title: "Old", completed: false, user: new mongoose.Types.ObjectId(mona.id) });
  const list = await as(mona).get("/tasks");
  assert.ok(list.json.some((t) => t._id === String(legacy.insertedId)));
});

test("cross-org — Org A ka task Org B ke route se 404 (dono ka member hone ke bawajood), aur badalta nahi", async () => {
  const orgA = await orgWithRoles("Org A");
  const orgB = await orgWithRoles("Org B");
  const task = await createTask(alice, orgA);

  assert.equal((await as(alice).get(`/orgs/${orgB}/tasks/${task._id}`)).status, 404);
  assert.equal((await as(alice).put(`/orgs/${orgB}/tasks/${task._id}`, { completed: true })).status, 404);
  assert.equal((await as(alice).delete(`/orgs/${orgB}/tasks/${task._id}`)).status, 404);
  assert.equal((await as(alice).get(`/orgs/${orgB}/tasks`)).json.tasks.length, 0);
  assert.equal((await Task().findById(task._id)).completed, false);
});

test("nikala gaya member — foran 404; us ke banaye tasks org mein rehte hain", async () => {
  const orgId = await orgWithRoles();
  const task = await createTask(mona, orgId);

  assert.equal((await as(alice).delete(`/orgs/${orgId}/members/${mona.id}`)).status, 200);
  assert.equal((await as(mona).get(`/orgs/${orgId}/tasks`)).status, 404);
  assert.equal((await as(mona).put(`/orgs/${orgId}/tasks/${task._id}`, { completed: true })).status, 404);

  const list = await as(alice).get(`/orgs/${orgId}/tasks`);
  assert.deepEqual(list.json.tasks.map((t) => t._id), [task._id]);
  assert.equal(list.json.tasks[0].user._id, mona.id);
});

test("org delete — us ke tasks bhi mitte hain (ginti jawab mein); doosri org aur personal tasks bache rehte hain", async () => {
  const orgId = await orgWithRoles();
  const other = await orgWithRoles("Keep");
  await createTask(mona, orgId);
  await createTask(adam, orgId);
  const kept = await createTask(mona, other);
  const personal = (await as(mona).post("/tasks", { title: "Mine" })).json;

  const res = await as(alice).delete(`/orgs/${orgId}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.deleted.tasks, 2);
  assert.equal(await Task().countDocuments({ org: orgId }), 0);
  assert.ok(await Task().exists({ _id: kept._id }));
  assert.ok(await Task().exists({ _id: personal._id }));
});
