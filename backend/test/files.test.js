// GET /files/:fileId ke tests — owner ko 200, bina token 401, doosre user ko 403, nahi hai to 404, aur file stream hoti hai
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
// files asli folders (uploads/avatars, uploads/tickets) mein jaati hain — har test ke baad sirf ISI file ke test users
// ki files mitate hain (naam "<userId>-..."), taake dev server ki kisi aur ki file na chhede
const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { setupTestApp, fileBytes } = require("./helpers");

const ctx = setupTestApp("files");
const { mongoose, config } = ctx;

const MB = 1024 * 1024;

// do users — owner ki file, other maangega
const owner = {};
const other = {};

const DIRS = () => [config.avatarUploadDir, config.ticketAttachmentDir, config.ticketUploadTmpDir];

// multipart upload — avatar ya ticket; fileId lautata hai
async function uploadAvatar(user, { type = "image/png", name = "me.png", bytes = 1024, content } = {}) {
  const form = new FormData();
  form.append("avatar", new Blob([fileBytes(type, bytes, content)], { type }), name);
  const res = await fetch(ctx.baseUrl + "/user/upload-avatar", {
    method: "POST",
    headers: { "x-api-key": config.apiKey, authorization: `Bearer ${user.token}` },
    body: form
  });
  assert.equal(res.status, 200);
  return (await res.json()).avatar;
}

async function createTicket(user, files) {
  const form = new FormData();
  form.append("title", "Files ka ticket");
  form.append("description", "attachments ke saath");
  for (const { type, name, bytes = 1024, content } of files) {
    form.append("attachments", new Blob([fileBytes(type, bytes, content)], { type }), name);
  }
  const res = await fetch(ctx.baseUrl + "/tickets", {
    method: "POST",
    headers: { "x-api-key": config.apiKey, authorization: `Bearer ${user.token}` },
    body: form
  });
  assert.equal(res.status, 201);
  return (await res.json()).ticket;
}

// GET /files/... — user null = bina token; token diya ho to wahi (jaise nakli token)
function getFile(route, { user = owner, token } = {}) {
  const headers = { "x-api-key": config.apiKey };
  const bearer = token ?? user?.token;
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  return fetch(ctx.baseUrl + route, { headers });
}

before(async () => {
  await ctx.start();
  for (const [user, email] of [[owner, "files-owner@example.test"], [other, "files-other@example.test"]]) {
    const verified = await ctx.verifiedAccount(email);
    user.token = verified.json.token;
    user.id = verified.json.user._id;
  }
});

// har test saaf shuru ho — dono users ki files teeno folders se, aur DB ke records
afterEach(async () => {
  for (const user of [owner, other]) {
    for (const dir of DIRS()) {
      for (const name of fs.readdirSync(dir).filter((n) => n.startsWith(`${user.id}-`))) {
        fs.unlinkSync(path.join(dir, name));
      }
    }
  }
  await mongoose.model("File").deleteMany({});
  await mongoose.model("Ticket").deleteMany({});
  await mongoose.model("User").updateMany({}, { $set: { avatar: null } });
});

after(async () => {
  await ctx.stop();
});

// ---------- 200: owner ----------

test("200 — owner apna avatar le sakta hai: wahi bytes, sahi type, inline, nosniff, private cache", async () => {
  const content = fileBytes("image/jpeg", 5000);
  const fileId = await uploadAvatar(owner, { type: "image/jpeg", name: "me.jpg", content });

  const res = await getFile(`/files/${fileId}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
  assert.equal(res.headers.get("content-length"), "5000");
  assert.equal(res.headers.get("content-disposition"), `inline; filename="me.jpg"; filename*=UTF-8''me.jpg`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(content));
});

test("200 — ticket attachment: attachment._id hi fileId; PDF hamesha attachment, tasveer ?download=1 par attachment", async () => {
  const pdf = fileBytes("application/pdf", 3000);
  const ticket = await createTicket(owner, [
    { type: "application/pdf", name: "bill.pdf", content: pdf },
    { type: "image/png", name: "screen.png" }
  ]);
  const [pdfFile, pngFile] = ticket.attachments;

  const pdfRes = await getFile(`/files/${pdfFile._id}`);
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get("content-type"), "application/pdf");
  assert.match(pdfRes.headers.get("content-disposition"), /^attachment; filename="bill\.pdf"/, "PDF inline nahi");
  assert.ok(Buffer.from(await pdfRes.arrayBuffer()).equals(pdf));

  const inline = await getFile(`/files/${pngFile._id}`);
  assert.match(inline.headers.get("content-disposition"), /^inline;/);
  await inline.arrayBuffer();

  const download = await getFile(`/files/${pngFile._id}?download=1`);
  assert.match(download.headers.get("content-disposition"), /^attachment; filename="screen\.png"/);
  await download.arrayBuffer();
});

test("200 — Urdu/ajeeb naam: header toot-ta nahi, filename* mein UTF-8, filename mein \" aur non-ASCII nahi", async () => {
  const ticket = await createTicket(owner, [{ type: "image/png", name: 'رسید "final".png' }]);
  const res = await getFile(`/files/${ticket.attachments[0]._id}?download=1`);
  assert.equal(res.status, 200);
  const header = res.headers.get("content-disposition");
  assert.match(header, /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
  assert.equal(header.split('"').length, 3, "naam ke andar ka \" header ko nahi todta");
  assert.equal(decodeURIComponent(header.split("UTF-8''")[1]), 'رسید "final".png');
  await res.arrayBuffer();
});

test("200 — ticket ka malik bhi le sakta hai, chahe File.owner koi aur ho ('or the ticket it's attached to')", async () => {
  const ticket = await createTicket(owner, [{ type: "image/png", name: "screen.png" }]);
  const fileId = ticket.attachments[0]._id;
  // owner kisi aur ka kar do — ticket abhi bhi owner ka
  await mongoose.model("File").updateOne({ _id: fileId }, { $set: { owner: other.id } });

  const res = await getFile(`/files/${fileId}`);
  assert.equal(res.status, 200, "ticket owner ke raaste ijazat");
  await res.arrayBuffer();
});

// ---------- 401: bina login ----------

test("401 — token nahi, ya nakli/expired token: file nahi, sirf { message }", async () => {
  const fileId = await uploadAvatar(owner);

  for (const [label, opts] of [
    ["bina token", { user: null }],
    ["nakli token", { token: "abc.def.ghi" }]
  ]) {
    const res = await getFile(`/files/${fileId}`, opts);
    assert.equal(res.status, 401, label);
    assert.equal(res.headers.get("content-type").split(";")[0], "application/json", label);
    assert.ok((await res.json()).message, label);
  }
});

test("401 pehle — bina token ke ghalat/na-maujood id par bhi 401 (404/403 se pata na chale ke file hai)", async () => {
  const res = await getFile(`/files/${new mongoose.Types.ObjectId()}`, { user: null });
  assert.equal(res.status, 401);
});

// ---------- 403: doosra logged-in user ----------

test("403 — doosra user owner ka avatar aur ticket attachment nahi le sakta", async () => {
  const avatarId = await uploadAvatar(owner);
  const ticket = await createTicket(owner, [{ type: "application/pdf", name: "bill.pdf" }]);

  for (const fileId of [avatarId, ticket.attachments[0]._id]) {
    const res = await getFile(`/files/${fileId}`, { user: other });
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { message: "You do not have access to this file" });
    // ?download=1 se bhi nahi
    assert.equal((await getFile(`/files/${fileId}?download=1`, { user: other })).status, 403);
  }

  // owner ke liye wahi id ab bhi 200
  const mine = await getFile(`/files/${avatarId}`);
  assert.equal(mine.status, 200);
  await mine.arrayBuffer();
});

// ---------- 404: file nahi ----------

test("404 — na-maujood id, ghalat shakal ki id, aur purana static URL", async () => {
  for (const route of [`/files/${new mongoose.Types.ObjectId()}`, "/files/abc", "/files/..%2f..%2f.env"]) {
    const res = await getFile(route);
    assert.equal(res.status, 404, route);
    assert.deepEqual(await res.json(), { message: "File not found" }, route);
  }

  const fileId = await uploadAvatar(owner);
  const { storedName } = await mongoose.model("File").findById(fileId).lean();
  assert.equal((await getFile(`/uploads/avatars/${storedName}`)).status, 404, "express.static hata diya");
});

test("404 — DB mein record hai lekin disk par file nahi: response mein server ka path nahi", async () => {
  const fileId = await uploadAvatar(owner);
  const { storedName } = await mongoose.model("File").findById(fileId).lean();
  fs.unlinkSync(path.join(config.avatarUploadDir, storedName));

  const res = await getFile(`/files/${fileId}`);
  const text = await res.text();
  assert.equal(res.status, 404);
  assert.deepEqual(JSON.parse(text), { message: "File not found" });
  assert.ok(!text.includes(config.avatarUploadDir) && !text.includes("ENOENT"), text);
});

// ---------- streaming ----------

test("1 MB se badi file stream hoti hai — createReadStream, readFile nahi; poore bytes aur Content-Length sahi", async () => {
  const content = fileBytes("application/pdf", Math.round(1.8 * MB));
  const ticket = await createTicket(owner, [{ type: "application/pdf", name: "big.pdf", content }]);

  // controller fs ke object se call karta hai — yahan jasoos laga kar ginte hain (app isi process mein chal rahi hai)
  const calls = { stream: 0, readFile: 0 };
  const { createReadStream, readFileSync } = fs;
  const { readFile } = fs.promises;
  fs.createReadStream = (...args) => {
    calls.stream++;
    return createReadStream(...args);
  };
  fs.readFileSync = (...args) => {
    calls.readFile++;
    return readFileSync(...args);
  };
  fs.promises.readFile = (...args) => {
    calls.readFile++;
    return readFile(...args);
  };

  try {
    const res = await getFile(`/files/${ticket.attachments[0]._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-length"), String(content.length));
    // fetch body bhi tukdon mein aati hai — kam az kam ek se zyada chunk
    let chunks = 0;
    const received = [];
    for await (const chunk of res.body) {
      chunks++;
      received.push(chunk);
    }
    assert.ok(Buffer.concat(received).equals(content), "poori file sahi");
    assert.ok(chunks > 1, `stream tukdon mein aaya (${chunks} chunks)`);
  } finally {
    fs.createReadStream = createReadStream;
    fs.readFileSync = readFileSync;
    fs.promises.readFile = readFile;
  }

  assert.equal(calls.stream, 1, "createReadStream se bheji");
  assert.equal(calls.readFile, 0, "poori file memory mein nahi padhi");
});

// ---------- signed URLs (10 minute, bina token) ----------

// POST /files/:fileId/signed-url — { status, json }
async function signedUrl(fileId, user = owner) {
  const headers = { "x-api-key": config.apiKey };
  if (user) headers.authorization = `Bearer ${user.token}`;
  const res = await fetch(`${ctx.baseUrl}/files/${fileId}/signed-url`, { method: "POST", headers });
  return { status: res.status, json: await res.json() };
}

test("signed URL — owner banata hai (10 minute), link BINA token ke file deta hai, ?download=1 bhi", async () => {
  const content = fileBytes("image/png", 2000);
  const fileId = await uploadAvatar(owner, { content });

  const before = Math.floor(Date.now() / 1000);
  const { status, json } = await signedUrl(fileId);
  assert.equal(status, 200);
  assert.match(json.url, new RegExp(`^/files/${fileId}\\?expires=\\d+&sig=[A-Za-z0-9_-]{43}$`));
  assert.ok(!json.url.includes(owner.token), "link mein token nahi");
  const expires = Number(new URL(json.url, ctx.baseUrl).searchParams.get("expires"));
  assert.ok(expires >= before + 600 && expires <= before + 601, "10 minute");
  assert.equal(new Date(json.expiresAt).getTime(), expires * 1000);

  const res = await getFile(json.url, { user: null });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition"), /^inline;/);
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(content));

  const download = await getFile(`${json.url}&download=1`, { user: null });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  await download.arrayBuffer();
});

test("signed URL banana — bina token 401, doosre user ko 403, na-maujood file 404", async () => {
  const fileId = await uploadAvatar(owner);
  assert.equal((await signedUrl(fileId, null)).status, 401);
  const stolen = await signedUrl(fileId, other);
  assert.equal(stolen.status, 403);
  assert.deepEqual(stolen.json, { message: "You do not have access to this file" });
  assert.equal((await signedUrl(new mongoose.Types.ObjectId())).status, 404);
});

test("signed URL — badla hua sig, expiry ya fileId, aur adhoora link → 403; token wala raasta nahi lagta", async () => {
  const fileId = await uploadAvatar(owner);
  const otherFile = await uploadAvatar(other);
  const { json } = await signedUrl(fileId);
  const url = new URL(json.url, ctx.baseUrl);
  const expires = url.searchParams.get("expires");
  const sig = url.searchParams.get("sig");
  const flip = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");

  for (const [label, route] of [
    ["sig ka ek harf badla", `/files/${fileId}?expires=${expires}&sig=${flip}`],
    ["expiry aage barhayi", `/files/${fileId}?expires=${Number(expires) + 3600}&sig=${sig}`],
    ["doosri file par wahi sig", `/files/${otherFile}?expires=${expires}&sig=${sig}`],
    ["sig nahi", `/files/${fileId}?expires=${expires}`],
    ["expires nahi", `/files/${fileId}?sig=${sig}`],
    ["chhota sig", `/files/${fileId}?expires=${expires}&sig=abc`],
    ["do sig", `/files/${fileId}?expires=${expires}&sig=${sig}&sig=${sig}`]
  ]) {
    // owner ka token saath ho tab bhi — link ghalat hai to 403, token par wapas nahi girte
    const res = await getFile(route);
    assert.equal(res.status, 403, label);
    assert.deepEqual(await res.json(), { message: "Invalid or expired file link" }, label);
  }
});

test("signed URL — 10 minute baad expire → 403", async (t) => {
  const fileId = await uploadAvatar(owner);
  const { json } = await signedUrl(fileId);

  // ghadi 10 minute + 1 second aage — sirf Date, timers nahi (fetch/Mongo ke timers chalte rahen)
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 601 * 1000 });
  const res = await getFile(json.url, { user: null });
  t.mock.timers.reset();

  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { message: "Invalid or expired file link" });
});

test("signed URL — file mit gayi to sahi link bhi 404", async () => {
  const fileId = await uploadAvatar(owner);
  const { json } = await signedUrl(fileId);
  await mongoose.model("File").deleteOne({ _id: fileId });
  const res = await getFile(json.url, { user: null });
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { message: "File not found" });
});
