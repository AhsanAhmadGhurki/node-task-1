// avatar upload ke tests — POST /user/upload-avatar (multipart, field "avatar")
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
// files asli folder (backend/uploads/avatars) mein jaati hain — har test ke baad sirf ISI test user ki files mitate hain
// (naam "<userId>-<time>.<ext>"), taake dev server ki kisi aur ki file na chhede
const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { setupTestApp, fileBytes } = require("./helpers");

const ctx = setupTestApp("avatar");
const { mongoose, config } = ctx;

const MAX_BYTES = 2 * 1024 * 1024;
const FILENAME_PATTERN = /^\/uploads\/avatars\/([0-9a-f]{24})-(\d+)\.(jpg|png|webp)$/;

let token;
let userId;

// is test user ki files jo abhi disk par hain
const userFiles = () => fs.readdirSync(config.avatarUploadDir).filter((name) => name.startsWith(`${userId}-`));
const dbAvatar = async () => (await mongoose.model("User").findById(userId).lean()).avatar;

// multipart request — ctx.request sirf JSON bhejta hai
// parts: [{ field, type, name, bytes, content }] — khaali array = form mein koi file nahi
async function upload(parts, { auth = true } = {}) {
  const form = new FormData();
  for (const { field = "avatar", type = "image/png", name = "me.png", bytes = 1024, content } of parts) {
    form.append(field, new Blob([fileBytes(type, bytes, content)], { type }), name);
  }
  if (parts.length === 0) {
    form.append("note", "no file here");
  }
  const headers = { "x-api-key": config.apiKey };
  if (auth) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(ctx.baseUrl + "/user/upload-avatar", { method: "POST", headers, body: form });
  return { status: res.status, json: await res.json() };
}

before(async () => {
  await ctx.start();
  const verified = await ctx.verifiedAccount("avatar@example.test");
  token = verified.json.token;
  userId = verified.json.user._id;
});

// har test saaf shuru ho — is user ki files aur DB ka avatar dono khaali
afterEach(async () => {
  for (const name of userFiles()) {
    fs.unlinkSync(path.join(config.avatarUploadDir, name));
  }
  await mongoose.model("User").updateOne({ _id: userId }, { $set: { avatar: null } });
});

after(async () => {
  await ctx.stop();
});

for (const [type, name, ext] of [
  ["image/jpeg", "holiday photo.JPEG", "jpg"],
  ["image/png", "me.png", "png"],
  ["image/webp", "me.webp", "webp"]
]) {
  test(`${type} → 200; naam <userId>-<time>.${ext} (asli naam nahi), DB aur disk dono mein wahi`, async () => {
    const res = await upload([{ type, name }]);
    assert.equal(res.status, 200);
    assert.equal(res.json.message, "Avatar uploaded successfully");

    const match = FILENAME_PATTERN.exec(res.json.avatar);
    assert.ok(match, res.json.avatar);
    assert.equal(match[1], userId);
    assert.equal(match[3], ext, "extension mimetype se, file ke naam se nahi");
    assert.ok(!res.json.avatar.includes(path.parse(name).name), "user ka diya hua naam use nahi hota");

    assert.equal(await dbAvatar(), res.json.avatar);
    assert.deepEqual(userFiles(), [path.basename(res.json.avatar)]);
  });
}

test("'evil.html' (asli HTML) ko image/png bata kar bheja → 415, disk aur DB mein kuch nahi", async () => {
  const content = Buffer.from("<html><script>alert(1)</script></html>");
  const res = await upload([{ type: "image/png", name: "evil.html", content }]);
  assert.equal(res.status, 415);
  assert.equal(res.json.message, "Avatar must be a valid JPEG, PNG or WebP image.");
  assert.deepEqual(userFiles(), [], "Multer ki likhi file mita di gayi");
  assert.equal(await dbAvatar(), null);
});

// declared type sahi, lekin bytes kisi image ke nahi (sirf 0x01) — Content-Type par bharosa nahi
for (const type of ["image/jpeg", "image/png", "image/webp"]) {
  test(`${type} bata kar nakli bytes → 415, disk aur DB mein kuch nahi`, async () => {
    const res = await upload([{ type, content: Buffer.alloc(1024, 1) }]);
    assert.equal(res.status, 415);
    assert.equal(res.json.message, "Avatar must be a valid JPEG, PNG or WebP image.");
    assert.deepEqual(userFiles(), []);
    assert.equal(await dbAvatar(), null);
  });
}

// asli WebP bytes, lekin image/png bata kar — allowed type hai, phir bhi declared se alag → 415
// (warna WebP ".png" naam se save hoti, kyunki extension declared type se banta hai)
test("asli WebP ko image/png bata kar bheja → 415 (mime mismatch), disk aur DB mein kuch nahi", async () => {
  const content = fileBytes("image/webp", 1024);
  const res = await upload([{ type: "image/png", name: "me.png", content }]);
  assert.equal(res.status, 415);
  assert.equal(res.json.message, "Avatar must be a valid JPEG, PNG or WebP image.");
  assert.deepEqual(userFiles(), []);
  assert.equal(await dbAvatar(), null);
});

test("pehle se avatar ho aur nakli file aaye → 415; purana avatar DB aur disk dono mein salamat", async () => {
  const first = await upload([{ type: "image/jpeg", name: "first.jpg" }]);
  assert.equal(first.status, 200);
  const firstFile = path.basename(first.json.avatar);

  const res = await upload([{ type: "image/png", content: Buffer.alloc(1024, 1) }]);
  assert.equal(res.status, 415);
  assert.equal(await dbAvatar(), first.json.avatar, "DB purane par hi");
  assert.deepEqual(userFiles(), [firstFile], "sirf purani file — nakli wali mit gayi, purani nahi mitti");
});

test("pehla avatar badla → DB naye par, purani file disk se mit gayi, nayi maujood", async () => {
  const first = await upload([{ type: "image/jpeg", name: "first.jpg" }]);
  assert.equal(first.status, 200);
  const firstFile = path.basename(first.json.avatar);
  assert.deepEqual(userFiles(), [firstFile]);

  const second = await upload([{ type: "image/png", name: "second.png" }]);
  assert.equal(second.status, 200);
  const secondFile = path.basename(second.json.avatar);
  assert.notEqual(secondFile, firstFile);

  assert.equal(await dbAvatar(), second.json.avatar);
  assert.deepEqual(userFiles(), [secondFile], "sirf naya — purana mit gaya");
});

test("file nahi bheji → 400", async () => {
  const res = await upload([]);
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "Avatar file is required");
  assert.equal(await dbAvatar(), null);
});

test("galat field ('photo') → 400, disk par kuch nahi", async () => {
  const res = await upload([{ field: "photo" }]);
  assert.equal(res.status, 400);
  assert.equal(res.json.message, 'Only the "avatar" file field is allowed.');
  assert.deepEqual(userFiles(), []);
  assert.equal(await dbAvatar(), null);
});

for (const [type, name] of [
  ["text/html", "evil.html"],
  ["image/svg+xml", "evil.svg"],
  ["application/pdf", "doc.pdf"]
]) {
  test(`${type} → 400, disk par kuch nahi`, async () => {
    const res = await upload([{ type, name }]);
    assert.equal(res.status, 400);
    assert.equal(res.json.message, "Avatar must be a JPEG, PNG or WebP image.");
    assert.deepEqual(userFiles(), []);
    assert.equal(await dbAvatar(), null);
  });
}

test("2 MB se 1 byte zyada → 413, adhoori file bhi disk par nahi", async () => {
  const res = await upload([{ bytes: MAX_BYTES + 1 }]);
  assert.equal(res.status, 413);
  assert.equal(res.json.message, "Avatar file is too large. Maximum size is 2 MB.");
  assert.deepEqual(userFiles(), []);
  assert.equal(await dbAvatar(), null);
});

test("theek 2 MB → 200 (had ke andar)", async () => {
  const res = await upload([{ bytes: MAX_BYTES }]);
  assert.equal(res.status, 200);
  assert.equal(fs.statSync(path.join(config.avatarUploadDir, path.basename(res.json.avatar))).size, MAX_BYTES);
});

test("do files ek request mein → 400, disk par kuch nahi", async () => {
  const res = await upload([{ name: "a.png" }, { name: "b.png" }]);
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "Invalid file upload.");
  assert.deepEqual(userFiles(), []);
  assert.equal(await dbAvatar(), null);
});

test("token nahi → 401, Multer chala hi nahi (disk par kuch nahi)", async () => {
  const res = await upload([{}], { auth: false });
  assert.equal(res.status, 401);
  assert.deepEqual(userFiles(), []);
});

test("upload hui tasveer GET /uploads/avatars/<file> par milti hai — sahi type + nosniff; API key zaroori; folder/bahar ki file nahi", async () => {
  const res = await upload([{ type: "image/webp", name: "me.webp", bytes: 300 }]);
  assert.equal(res.status, 200);

  const get = (route, apiKey = config.apiKey) => fetch(ctx.baseUrl + route, { headers: apiKey ? { "x-api-key": apiKey } : {} });

  const served = await get(res.json.avatar);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/webp");
  assert.equal(served.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await served.arrayBuffer()).byteLength, 300);

  assert.equal((await get(res.json.avatar, null)).status, 401, "API key ke bina nahi");
  assert.equal((await get("/uploads/avatars/")).status, 404, "folder ki list nahi");
  assert.equal((await get("/uploads/avatars/nope.png")).status, 404);
  // folder se bahar (.env, source) kabhi nahi
  assert.equal((await get("/uploads/avatars/..%2f..%2f.env")).status, 404);
  assert.equal((await get("/uploads/avatars/../../package.json")).status, 404);
});
