// user profile ke kaam — avatar upload aur name/phone
const userService = require("../services/userService");
const BadRequestError = require("../utils/BadRequestError");

// POST /user/upload-avatar — multipart/form-data, field "avatar"
// Multer (upload.single) file pehle hi disk par rakh chuka hai — req.file
async function uploadAvatar(req, res, next) {
  try {
    // field bheja hi nahi (ya khaali form) — Multer error nahi deta, bas req.file nahi hota
    if (!req.file) {
      throw new BadRequestError("Avatar file is required");
    }

    // mimetype — client ka declared type; service asli bytes se milayegi
    const avatar = await userService.setAvatar(
      req.user.id,
      req.file.filename,
      req.file.mimetype
    );

    res.status(200).json({ message: "Avatar uploaded successfully", avatar });
  } catch (err) {
    next(err);
  }
}

// GET /user/profile — toJSON password waghaira pehle hi hata deta hai
async function getProfile(req, res, next) {
  try {
    const user = await userService.getProfile(req.user.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// PATCH /user/profile — rules (validators/userValidators.js) pehle hi check kar chuke
// sirf name aur phone uthao — req.body poora service ko kabhi nahi (isVerified, password jaise fields na badlein)
async function updateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;
    const user = await userService.updateProfile(req.user.id, { name, phone });
    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadAvatar,
  getProfile,
  updateProfile
};
