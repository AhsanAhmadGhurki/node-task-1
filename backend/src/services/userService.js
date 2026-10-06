// user profile ka DB kaam — abhi sirf avatar
const fs = require("fs/promises");
const path = require("path");
const User = require("../models/User");
const config = require("../config");
const NotFoundError = require("../utils/NotFoundError");

// DB mein yahi path jaata hai — frontend isi se picture maangega (jab /uploads serve hoga)
const AVATAR_URL_PREFIX = "/uploads/avatars/";

// avatar ki file mitao — sirf naam (basename) lo aur hamesha avatars folder ke andar dhoondo,
// taake DB ki koi galat value ("../../.env" jaisi) folder ke bahar ki file na mita sake
// file pehle hi na ho to bhi theek — mitana hi to tha
async function removeAvatarFile(avatar) {
  await fs.unlink(path.join(config.avatarUploadDir, path.basename(avatar))).catch(() => {});
}

// naya avatar lagao, purani file mitao — naya path lautata hai
// filename — Multer ki di hui (upload.js: <userId>-<time><ext>), file disk par aa chuki hai
async function setAvatar(userId, filename) {
  const avatar = AVATAR_URL_PREFIX + filename;

  // ek hi query mein naya path likho aur purana wala lo — read (findById) → save() mein do uploads ek saath
  // aayein to dono ek hi "purana" dekhte aur ek file hamesha ke liye reh jaati
  let previous;
  try {
    previous = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar } },
      { returnDocument: "before", projection: { avatar: 1 } }
    );
  } catch (err) {
    // DB fail — nayi file kisi kaam ki nahi, disk par na pade rahe
    await removeAvatarFile(filename);
    throw err;
  }

  // token sahi tha lekin user beech mein delete ho gaya (authMiddleware ke baad)
  if (!previous) {
    await removeAvatarFile(filename);
    throw new NotFoundError("User not found");
  }

  // DB mein naya path aa gaya — purani file ab bekaar
  if (previous.avatar) {
    await removeAvatarFile(previous.avatar);
  }

  return avatar;
}

module.exports = {
  setAvatar
};
