const express = require("express");
const fileController = require("../controllers/fileController");
const authMiddleware = require("../middleware/auth");
const fileAccess = require("../middleware/fileAccess");

// app.js mein "/files" par BINA authMiddleware — GET signed link se bhi chalta hai, is liye auth yahan har route par
const router = express.Router();

// POST /files/:fileId/signed-url — sirf token se, aur sirf owner (warna 403/404); { url, expiresAt } (10 minute)
router.post("/:fileId/signed-url", authMiddleware, fileController.createSignedUrl);

// GET /files/:fileId — token (owner check) YA ?expires=&sig= (signed link); stream kar ke
// ?download=1 — tasveer bhi "Save as" ho (Content-Disposition: attachment); signature mein nahi, sirf header badalta hai
router.get("/:fileId", fileAccess, fileController.serveFile);

module.exports = router;
