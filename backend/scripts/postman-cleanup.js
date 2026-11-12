// Postman/Newman collection ke banaye test users aur unka saara data mitao
// sirf pm-a-<number>@example.test / pm-b-<number>@example.test — kisi asli ya QA account ko haath nahi lagata
// chalao: npm run postman:cleanup (backend/ se)
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const config = require("../src/config");

const TEST_EMAIL = /^pm-[ab]-\d+@example\.test$/;

// in folders mein files ka naam "<userId>-..." hota hai
const UPLOAD_DIRS = [config.avatarUploadDir, config.ticketAttachmentDir, config.ticketUploadTmpDir];

async function cleanup() {
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;

  const users = await db.collection("users").find({ email: TEST_EMAIL }).project({ email: 1 }).toArray();
  const ids = users.map((u) => u._id);
  const deleted = {};

  // user ka data pehle, user aakhir mein — beech mein rukne par bhi dobara chalane se sab mil jaata hai
  for (const name of ["tasks", "otps", "refreshtokens", "tickets"]) {
    deleted[name] = (await db.collection(name).deleteMany({ user: { $in: ids } })).deletedCount;
  }
  deleted.fileRecords = (await db.collection("files").deleteMany({ owner: { $in: ids } })).deletedCount;
  deleted.users = (await db.collection("users").deleteMany({ _id: { $in: ids } })).deletedCount;

  let diskFiles = 0;
  const prefixes = ids.map((id) => `${id}-`);
  for (const dir of UPLOAD_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (prefixes.some((p) => name.startsWith(p))) {
        fs.unlinkSync(path.join(dir, name));
        diskFiles++;
      }
    }
  }
  deleted.diskFiles = diskFiles;

  // tasdeeq — kuch bacha to saaf nazar aaye
  const left = await db.collection("users").countDocuments({ email: TEST_EMAIL });

  console.log(`Postman cleanup: ${users.length} test user(s)`, deleted, `— left: ${left}`);
  await mongoose.disconnect();
  if (left > 0) process.exitCode = 1;
}

cleanup().catch(async (err) => {
  console.error("Postman cleanup failed:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
