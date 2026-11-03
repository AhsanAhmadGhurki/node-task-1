// uploaded files ka DB aur disk ka kaam — kaunsi file, kis ki, disk par kahan
// controller ko Mongoose ya fs ka pata nahi hona chahiye
const fs = require("fs");
const path = require("path");

const File = require("../models/File");
const Ticket = require("../models/Ticket");
const NotFoundError = require("../utils/NotFoundError");
const ForbiddenError = require("../utils/ForbiddenError");
const config = require("../config");
const { createSignedPath } = require("../utils/signedUrl");

// kind → disk ka folder. path kabhi user ke input se nahi banta, sirf yahan se + storedName ka basename
const FILE_DIRS = {
  avatar: config.avatarUploadDir,
  "ticket-attachment": config.ticketAttachmentDir
};

// ObjectId ki shakal (24 hex) — warna Mongoose CastError (400) deta; galat id ke liye bhi "nahi mili" (404)
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

// disk par file ka poora path — basename taake DB ki koi galat value ("../../.env") folder se bahar na le jaye
function filePathOf(file) {
  return path.join(FILE_DIRS[file.kind], path.basename(file.storedName));
}

// file ka record banao — disk par file pehle se (Multer + signature check ke baad)
// _id diya ho to wahi (ticket attachment ka _id = fileId, taake ticket ke JSON mein jo id hai wahi /files par chale)
async function createFile({ _id, owner, kind, ticket = null, storedName, originalName, mimetype, size }) {
  return File.create({ _id, owner, kind, ticket, storedName, originalName, mimetype, size });
}

// record aur disk file dono mitao — disk file pehle hi na ho to bhi theek
async function deleteFile(fileId) {
  const file = await File.findByIdAndDelete(fileId);
  if (file) {
    await fs.promises.unlink(filePathOf(file)).catch(() => {});
  }
}

// kya ye user is file ko dekh sakta hai?
// 1. file ka owner khud — avatar aur apni attachment
// 2. ya us ticket ka owner jis se file judi hai — "owns that file (or the ticket it's attached to)"
//    (abhi dono hamesha ek hi user hain, lekin ticket ka malik badle ya admin aaye to rule wahi rahe)
async function canAccess(file, userId) {
  if (file.owner.toString() === userId) return true;

  if (file.ticket) {
    return Boolean(await Ticket.exists({ _id: file.ticket, user: userId }));
  }

  return false;
}

// GET /files/:fileId ke liye — file ka record aur disk path, ya error
// order zaroori: pehle "hai bhi?" (404), phir "tumhari hai?" (403)
// (task ki shart: doosre user ko 403. tickets ke routes 404 dete hain taake id ka hona bhi na pata chale —
//  yahan task ke mutabiq 403, is ki qeemat: koi id try kar ke jaan sakta hai ke file maujood hai)
async function getFileForUser(fileId, userId) {
  if (!OBJECT_ID_PATTERN.test(fileId)) {
    throw new NotFoundError("File not found");
  }

  const file = await File.findById(fileId);
  if (!file) {
    throw new NotFoundError("File not found");
  }

  if (!(await canAccess(file, userId))) {
    throw new ForbiddenError("You do not have access to this file");
  }

  return { file, filePath: filePathOf(file) };
}

// signed link wali request — ownership link banate waqt (createSignedUrl) check ho chuki, ab sirf "hai bhi?" (404)
// signature fileId par hai, to doosri file ka link is se nahi ban sakta
async function getFileById(fileId) {
  const file = OBJECT_ID_PATTERN.test(fileId) ? await File.findById(fileId) : null;
  if (!file) {
    throw new NotFoundError("File not found");
  }
  return { file, filePath: filePathOf(file) };
}

// 10 minute ka link — sirf owner (ya ticket ka malik) bana sakta hai; doosre ko wahi 403/404
async function createSignedUrl(fileId, userId) {
  await getFileForUser(fileId, userId);
  return createSignedPath(fileId);
}

module.exports = {
  FILE_DIRS,
  filePathOf,
  createFile,
  deleteFile,
  getFileForUser,
  getFileById,
  createSignedUrl
};
