// support tickets ke tests — POST /tickets (multipart: title, description, 0–3 files "attachments"), list, get, download
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
// files asli folders (uploads/tmp/tickets, uploads/tickets) mein jaati hain — har test ke baad sirf ISI file ke test users
// ki files mitate hain (naam "<userId>-<uuid>.<ext>"), taake dev server ki kisi aur ki file na chhede
const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { setupTestApp, fileBytes } = require("./helpers");

const ctx = setupTestApp("tickets");
const { mongoose, config } = ctx;

const MB = 1024 * 1024;
const INVALID_FILE_MESSAGE = "Each attachment must be a valid JPEG, PNG, WebP or PDF file.";

// do users — ownership ke tests ke liye
const owner = {};
const other = {};

// in users ki files ek folder mein
const filesIn = (dir, user = owner) => fs.readdirSync(dir).filter((name) => name.startsWith(`${user.id}-`));
const tmpFiles = (user) => filesIn(config.ticketUploadTmpDir, user);
const savedFiles = (user) => filesIn(config.ticketAttachmentDir, user);
const ticketCount = () => mongoose.model("Ticket").countDocuments({});

// all-or-nothing — reject hui request ke baad na temp mein file, na final mein, na DB mein ticket
async function assertNothingLeft() {
  assert.deepEqual(tmpFiles(), [], "temp folder mein kuch nahi");
  assert.deepEqual(savedFiles(), [], "final folder mein kuch nahi");
  assert.equal(await ticketCount(), 0, "DB mein koi ticket nahi");
}

// multipart request — text fields pehle, phir files
// title/description null = field bheji hi nahi (undefined par default lag jaata); files: [{ field, type, name, bytes, content }]
async function createTicket({ title = "Login nahi ho raha", description = "Password sahi hai phir bhi 401", files = [], user = owner, auth = true } = {}) {
  const form = new FormData();
  if (title !== null) form.append("title", title);
  if (description !== null) form.append("description", description);
  for (const { field = "attachments", type = "image/png", name = "screen.png", bytes = 1024, content } of files) {
    form.append(field, new Blob([fileBytes(type, bytes, content)], { type }), name);
  }
  const headers = { "x-api-key": config.apiKey };
  if (auth) headers.authorization = `Bearer ${user.token}`;
  const res = await fetch(ctx.baseUrl + "/tickets", { method: "POST", headers, body: form });
  return { status: res.status, json: await res.json() };
}

const get = (route, user = owner) =>
  fetch(ctx.baseUrl + route, { headers: { "x-api-key": config.apiKey, authorization: `Bearer ${user.token}` } });

before(async () => {
  await ctx.start();
  for (const [user, email] of [[owner, "tickets-owner@example.test"], [other, "tickets-other@example.test"]]) {
    const verified = await ctx.verifiedAccount(email);
    user.token = verified.json.token;
    user.id = verified.json.user._id;
  }
});

// har test saaf shuru ho — dono users ki files dono folders se, aur saare tickets
afterEach(async () => {
  for (const user of [owner, other]) {
    for (const dir of [config.ticketUploadTmpDir, config.ticketAttachmentDir]) {
      for (const name of filesIn(dir, user)) fs.unlinkSync(path.join(dir, name));
    }
  }
  await mongoose.model("Ticket").deleteMany({});
});

after(async () => {
  await ctx.stop();
});

test("3 valid files (jpg + png + pdf), 5 MB se kam → 201; files final folder mein, temp khaali, response mein storedName nahi", async () => {
  const res = await createTicket({
    files: [
      { type: "image/jpeg", name: "photo.jpg", bytes: 1 * MB },
      { type: "image/png", name: "screen.png", bytes: 1 * MB },
      { type: "application/pdf", name: "invoice.pdf", bytes: 1 * MB }
    ]
  });
  assert.equal(res.status, 201);
  const { ticket } = res.json;
  assert.equal(ticket.title, "Login nahi ho raha");
  assert.equal(ticket.user, owner.id);
  assert.deepEqual(ticket.attachments.map((a) => [a.originalName, a.mimetype, a.size]), [
    ["photo.jpg", "image/jpeg", 1 * MB],
    ["screen.png", "image/png", 1 * MB],
    ["invoice.pdf", "application/pdf", 1 * MB]
  ]);
  assert.ok(ticket.attachments.every((a) => a._id && !("storedName" in a)), "storedName andar ki baat hai");

  assert.deepEqual(tmpFiles(), []);
  const saved = savedFiles();
  assert.equal(saved.length, 3);
  assert.deepEqual(saved.map((name) => path.extname(name)).sort(), [".jpg", ".pdf", ".png"], "extension type se, naam se nahi");
});

test("bina file ke ticket → 201, attachments khaali", async () => {
  const res = await createTicket();
  assert.equal(res.status, 201);
  assert.deepEqual(res.json.ticket.attachments, []);
});

test("4 files ek request mein → 400; poori request reject, koi file ya ticket nahi bachta", async () => {
  const files = [1, 2, 3, 4].map((n) => ({ type: "image/png", name: `${n}.png` }));
  const res = await createTicket({ files });
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "You can attach at most 3 files.");
  await assertNothingLeft();
});

test("3 mein se 1 nakli (bytes kisi image ke nahi) → 415; baaki 2 sahi files bhi disk par nahi", async () => {
  const res = await createTicket({
    files: [
      { type: "image/jpeg", name: "ok.jpg" },
      { type: "image/png", name: "fake.png", content: Buffer.alloc(1024, 1) },
      { type: "application/pdf", name: "ok.pdf" }
    ]
  });
  assert.equal(res.status, 415);
  assert.equal(res.json.message, INVALID_FILE_MESSAGE);
  await assertNothingLeft();
});

test("asli HTML ko application/pdf bata kar bheja → 415, kuch nahi bachta", async () => {
  const content = Buffer.from("<html><script>alert(1)</script></html>");
  const res = await createTicket({ files: [{ type: "application/pdf", name: "evil.pdf", content }] });
  assert.equal(res.status, 415);
  await assertNothingLeft();
});

test("MIME mismatch — asli PDF ko image/png bata kar → 415 (dono types allowed, phir bhi)", async () => {
  const content = fileBytes("application/pdf", 1024);
  const res = await createTicket({ files: [{ type: "image/png", name: "doc.png", content }] });
  assert.equal(res.status, 415);
  assert.equal(res.json.message, INVALID_FILE_MESSAGE);
  await assertNothingLeft();
});

for (const [type, name] of [
  ["text/html", "evil.html"],
  ["image/svg+xml", "logo.svg"]
]) {
  test(`${type} → 400 (disk tak nahi pahunchti)`, async () => {
    const res = await createTicket({ files: [{ type: "image/png", name: "ok.png" }, { type, name }] });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "Attachments must be JPEG, PNG, WebP or PDF files.");
    await assertNothingLeft();
  });
}

test("galat field naam ('file') → 400", async () => {
  const res = await createTicket({ files: [{ field: "file" }] });
  assert.equal(res.status, 400);
  assert.equal(res.json.message, 'Only the "attachments" file field is allowed.');
  await assertNothingLeft();
});

test("ek file 2 MB se 1 byte badi → 413", async () => {
  const res = await createTicket({ files: [{ type: "image/png", name: "ok.png" }, { type: "application/pdf", bytes: 2 * MB + 1 }] });
  assert.equal(res.status, 413);
  assert.equal(res.json.message, "Each attachment must be at most 2 MB.");
  await assertNothingLeft();
});

test("har file 2 MB (had ke andar) lekin total 6 MB → 413; teeno mein se koi file nahi", async () => {
  const files = ["image/jpeg", "image/png", "application/pdf"].map((type) => ({ type, bytes: 2 * MB }));
  const res = await createTicket({ files });
  assert.equal(res.status, 413);
  assert.equal(res.json.message, "All attachments combined must be at most 5 MB.");
  await assertNothingLeft();
});

test("total theek 5 MB (2 + 2 + 1) → 201", async () => {
  const res = await createTicket({
    files: [
      { type: "image/jpeg", bytes: 2 * MB },
      { type: "image/png", bytes: 2 * MB },
      { type: "application/pdf", bytes: 1 * MB }
    ]
  });
  assert.equal(res.status, 201);
  assert.equal(savedFiles().length, 3);
});

test("title ya description na ho → 400, aur Multer ki likhi file temp se mit jaati hai", async () => {
  const file = [{ type: "image/png" }];
  for (const [fields, message] of [
    [{ title: null }, "Title is required"],
    [{ title: "   " }, "Title is required"],
    [{ title: "abcd" }, "Title must be between 5 and 100 characters"],
    [{ title: "  abcd  " }, "Title must be between 5 and 100 characters"],
    [{ title: "x".repeat(101) }, "Title must be between 5 and 100 characters"],
    [{ description: null }, "Description is required"],
    [{ description: "x".repeat(1001) }, "Description must be at most 1000 characters"]
  ]) {
    const res = await createTicket({ ...fields, files: file });
    assert.equal(res.status, 400, JSON.stringify(fields).slice(0, 60));
    assert.equal(res.json.message, message);
    await assertNothingLeft();
  }
});

test("256 characters ka original naam → 400 (Mongoose maxlength); move hui file bhi mit jaati hai", async () => {
  const name = `${"a".repeat(252)}.png`;
  const res = await createTicket({ files: [{ type: "image/png", name }] });
  assert.equal(res.status, 400);
  assert.match(res.json.message, /originalName/);
  await assertNothingLeft();
});

test("token nahi → 401, Multer chala hi nahi", async () => {
  const res = await createTicket({ auth: false, files: [{ type: "image/png" }] });
  assert.equal(res.status, 401);
  await assertNothingLeft();
});

test("list aur get sirf apne tickets — doosre user ka ticket 404, galat id 400", async () => {
  const created = (await createTicket({ title: "Mera ticket" })).json.ticket;

  const mine = await (await get("/tickets")).json();
  assert.deepEqual(mine.tickets.map((t) => t._id), [created._id]);

  const theirs = await (await get("/tickets", other)).json();
  assert.deepEqual(theirs.tickets, [], "doosre user ko kuch nahi dikhta");

  const one = await get(`/tickets/${created._id}`);
  assert.equal(one.status, 200);
  assert.equal((await one.json()).ticket.title, "Mera ticket");

  const stolen = await get(`/tickets/${created._id}`, other);
  assert.equal(stolen.status, 404);
  assert.equal((await stolen.json()).message, "Ticket not found");

  assert.equal((await get("/tickets/abc")).status, 400);
});

test("download — wahi bytes, asli naam ke saath attachment, nosniff; doosre user ko 404", async () => {
  const content = fileBytes("application/pdf", 3000);
  const { ticket } = (await createTicket({ files: [{ type: "application/pdf", name: "bill.pdf", content }] })).json;
  const route = `/tickets/${ticket._id}/attachments/${ticket.attachments[0]._id}`;

  const res = await get(route);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.match(res.headers.get("content-disposition"), /^attachment; filename="bill\.pdf"/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(content));

  const stolen = await get(route, other);
  assert.equal(stolen.status, 404);
  assert.equal((await stolen.json()).message, "Ticket not found");

  const unknown = await get(`/tickets/${ticket._id}/attachments/${new mongoose.Types.ObjectId()}`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).message, "Attachment not found");
});

test("DB mein attachment hai lekin file disk par nahi → 404, response mein server ka path nahi", async () => {
  const { ticket } = (await createTicket({ files: [{ type: "image/png" }] })).json;
  for (const name of savedFiles()) fs.unlinkSync(path.join(config.ticketAttachmentDir, name));

  const res = await get(`/tickets/${ticket._id}/attachments/${ticket.attachments[0]._id}`);
  const text = await res.text();
  assert.equal(res.status, 404);
  assert.deepEqual(JSON.parse(text), { message: "Attachment not found" });
  assert.ok(!text.includes(config.ticketAttachmentDir) && !text.includes("ENOENT"), text);
});
