// tasks ke tests — CRUD, ownership, title ki had, types
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("tasks");
let tokenA;
let tokenB;

before(async () => {
  await ctx.start();
  tokenA = (await ctx.verifiedAccount("a@example.com")).json.token;
  tokenB = (await ctx.verifiedAccount("b@example.com")).json.token;
});
after(() => ctx.stop());

const create = (token, body) => ctx.request("POST", "/tasks", { token, body });

test("title ki had 200 characters (trim ke baad) — create aur update dono", async () => {
  assert.equal((await create(tokenA, { title: "T".repeat(200) })).status, 201);
  // aage peeche ke spaces had mein nahi gine jaate
  assert.equal((await create(tokenA, { title: `  ${"S".repeat(200)}  ` })).status, 201);

  const tooLong = await create(tokenA, { title: "T".repeat(201) });
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.json.message, "Title must be at most 200 characters");
  assert.equal((await create(tokenA, { title: "T".repeat(90000) })).status, 400);

  const task = (await create(tokenA, { title: "short" })).json;
  const update = await ctx.request("PUT", `/tasks/${task._id}`, { token: tokenA, body: { title: "U".repeat(201) } });
  assert.equal(update.status, 400);
  assert.equal(update.json.message, "Title must be at most 200 characters");
});

test("CRUD — create, list, get, partial update, delete", async () => {
  const created = await create(tokenA, { title: "  Buy milk  " });
  assert.equal(created.status, 201);
  assert.equal(created.json.title, "Buy milk");
  assert.equal(created.json.completed, false);
  const id = created.json._id;

  const list = await ctx.request("GET", "/tasks", { token: tokenA });
  assert.ok(list.json.some((t) => t._id === id));
  assert.equal((await ctx.request("GET", `/tasks/${id}`, { token: tokenA })).json.title, "Buy milk");

  const done = await ctx.request("PUT", `/tasks/${id}`, { token: tokenA, body: { completed: true } });
  assert.equal(done.json.completed, true);
  assert.equal(done.json.title, "Buy milk");

  assert.equal((await ctx.request("DELETE", `/tasks/${id}`, { token: tokenA })).status, 200);
  assert.equal((await ctx.request("GET", `/tasks/${id}`, { token: tokenA })).status, 404);
});

test("ownership — doosre user ka task 404, body ka user/_id ignore", async () => {
  const task = (await create(tokenA, { title: "A ka", user: "000000000000000000000001", _id: "000000000000000000000002" })).json;
  assert.notEqual(task._id, "000000000000000000000002");
  assert.notEqual(task.user, "000000000000000000000001");

  for (const method of ["GET", "PUT", "DELETE"]) {
    const res = await ctx.request(method, `/tasks/${task._id}`, { token: tokenB, body: method === "PUT" ? { title: "hacked" } : undefined });
    assert.equal(res.status, 404, method);
  }
  assert.ok(!(await ctx.request("GET", "/tasks", { token: tokenB })).json.some((t) => t._id === task._id));
});

test("galat types aur ids → 400, kabhi 500 nahi", async () => {
  const task = (await create(tokenA, { title: "types" })).json;
  for (const body of [{ completed: "true" }, { completed: 1 }, { completed: null }, { title: 123 }, { title: null }, {}]) {
    assert.equal((await ctx.request("PUT", `/tasks/${task._id}`, { token: tokenA, body })).status, 400, JSON.stringify(body));
  }
  for (const body of [{ title: { $ne: null } }, { title: "x", completed: "yes" }, {}]) {
    assert.equal((await create(tokenA, body)).status, 400, JSON.stringify(body));
  }
  for (const id of ["123", "zzzzzzzzzzzzzzzzzzzzzzzz"]) {
    assert.equal((await ctx.request("GET", `/tasks/${id}`, { token: tokenA })).status, 400, id);
  }
});
