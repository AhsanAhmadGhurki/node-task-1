// user profile ke kaam — abhi sirf avatar upload
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

    const avatar = await userService.setAvatar(req.user.id, req.file.filename);

    res.status(200).json({ message: "Avatar uploaded successfully", avatar });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadAvatar
};
