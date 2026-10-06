const express = require("express");
const upload = require("../config/upload");
const userController = require("../controllers/userController");

// app.js mein "/user" par authMiddleware ke BAAD lagaya gaya hai — yahan har route logged-in user ka
// (upload.js filename ke liye req.user.id chahiye — isliye auth yahan dobara nahi, app.js mein pehle)
const router = express.Router();

// POST /user/upload-avatar — multipart/form-data, file field ka naam "avatar"
router.post(
  "/upload-avatar",
  upload.single("avatar"),
  userController.uploadAvatar
);

module.exports = router;
