// user profile ka DB kaam — avatar, name, phone
const fs = require("fs/promises");
const path = require("path");
const { assertFileSignature } = require("../utils/fileSignature");
const User = require("../models/User");
const config = require("../config");
const NotFoundError = require("../utils/NotFoundError");
const fileService = require("./fileService");

// avatar sirf ye tasveerein — upload.js ke allowedTypes jaisi hi list
const ALLOWED_AVATAR_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

// asli bytes ka check shared utility mein (tickets bhi wahi use karte hain) — yahan sirf avatar ki list aur message
async function validateAvatarFile(filePath, declaredMime) {
  await assertFileSignature(
    filePath,
    declaredMime,
    ALLOWED_AVATAR_MIMES,
    "Avatar must be a valid JPEG, PNG or WebP image."
  );
}

// avatar ki file mitao (abhi File record bana hi nahi) — sirf naam (basename) lo aur hamesha avatars folder
// ke andar dhoondo, taake koi galat value ("../../.env" jaisi) folder ke bahar ki file na mita sake
// file pehle hi na ho to bhi theek — mitana hi to tha
async function removeAvatarFile(filename) {
  await fs.unlink(path.join(config.avatarUploadDir, path.basename(filename))).catch(() => {});
}

// naya avatar lagao, purana (record + file) mitao — naya fileId lautata hai
// file — Multer ka req.file (upload.js: <userId>-<time><ext>), disk par aa chuki hai
// file.mimetype — client ka declared type (extension isi se bani), asli bytes se milana hai
async function setAvatar(userId, file) {
  const { filename, mimetype, originalname, size } = file;

  // DB chhoone se pehle asli bytes check karo — galat file disk par na rahe, na DB mein jaye
  const filePath = path.join(config.avatarUploadDir, filename);

  try {
    await validateAvatarFile(filePath, mimetype);
  } catch (err) {
    await removeAvatarFile(filename);
    throw err;
  }

  // pehle File record (owner = yahi user) — iske bina /files/:fileId isay pehchanta hi nahi
  let record;
  try {
    record = await fileService.createFile({
      owner: userId,
      kind: "avatar",
      storedName: filename,
      originalName: originalname,
      mimetype,
      size
    });
  } catch (err) {
    await removeAvatarFile(filename);
    throw err;
  }

  // ek hi query mein naya fileId likho aur purana wala lo — read (findById) → save() mein do uploads ek saath
  // aayein to dono ek hi "purana" dekhte aur ek file hamesha ke liye reh jaati
  let previous;
  try {
    previous = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: record._id } },
      { returnDocument: "before", projection: { avatar: 1 } }
    );
  } catch (err) {
    // DB fail — naya record aur file kisi kaam ke nahi
    await fileService.deleteFile(record._id);
    throw err;
  }

  // token sahi tha lekin user beech mein delete ho gaya (authMiddleware ke baad)
  if (!previous) {
    await fileService.deleteFile(record._id);
    throw new NotFoundError("User not found");
  }

  // DB mein naya fileId aa gaya — purana record aur file ab bekaar
  if (previous.avatar) {
    await fileService.deleteFile(previous.avatar);
  }

  return record._id.toString();
}

// apni profile — DB se taaza (session mein purani ho sakti hai, ya login ke waqt name tha hi nahi)
async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

// name/phone badlo — sirf jo bheja gaya ($set mein undefined nahi jaata), naya user lautata hai
// runValidators — model ke rules (length, phone format) update par bhi chalein
async function updateProfile(userId, { name, phone }) {
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (phone !== undefined) changes.phone = phone;

  const user = await User.findByIdAndUpdate(userId, { $set: changes }, { returnDocument: "after", runValidators: true });

  // token sahi tha lekin user beech mein delete ho gaya
  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}

module.exports = {
  setAvatar,
  getProfile,
  updateProfile
};
