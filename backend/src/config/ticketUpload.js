// ticket attachments ki Multer settings — files pehle temp folder mein, check pass hon to service final folder mein le jaati hai
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const config = require("./index");
const BadRequestError = require("../utils/BadRequestError");
const PayloadTooLargeError = require("../utils/PayloadTooLargeError");

// backend/uploads/tmp/tickets/ — serve nahi hota, to bina check ki file URL se kabhi nahi milti
const uploadDir = config.ticketUploadTmpDir;
fs.mkdirSync(uploadDir, { recursive: true });

// avatar se zyada — yahan PDF bhi; extension inhi se, user ke file naam se kabhi nahi
// mimetype client ka bataya hua Content-Type hai; asli bytes service mein fileSignature se check hote hain
const allowedTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf"
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // naam: <userId>-<uuid><ext> — Date.now() nahi: ek request ki 3 files ek hi millisecond mein aa kar takra jaatin
  // req.user — authMiddleware is se PEHLE lagna zaroori hai
  filename: (req, file, cb) => {
    const extension = allowedTypes[file.mimetype];
    const filename = `${req.user.id}-${crypto.randomUUID()}${extension}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    // har file 2 MB tak — sab files mila kar 5 MB wali had service lagati hai (Multer mein total ki had nahi)
    fileSize: 2 * 1024 * 1024,
    // 4th file par poori request reject — chupke se chhodi nahi jaati
    files: 3
  },
  // file ke naam (originalname) utf8 mein — warna Urdu/emoji wale naam latin1 mein bigad jaate
  defParamCharset: "utf8",
  // allowedTypes ke ilawa (html, svg…) — disk par likhne se PEHLE reject
  fileFilter: (req, file, cb) => {
    if (!allowedTypes[file.mimetype]) {
      return cb(new BadRequestError(
        "Attachments must be JPEG, PNG, WebP or PDF files."
      ));
    }

    cb(null, true);
  }
});

// upload.array ke MulterError yahin ticket ke messages mein badlo — errorHandler ka Multer branch avatar ki baat karta hai
// Multer apni galti par (size, count, fileFilter, abort) likhi hui files khud mita deta hai
function uploadAttachments(req, res, next) {
  upload.array("attachments", 3)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new PayloadTooLargeError(
          "Each attachment must be at most 2 MB."
        ));
      }

      // limits.files se LIMIT_FILE_COUNT, ya array ki maxCount se LIMIT_UNEXPECTED_FILE (field "attachments" hi) — dono 4th file
      if (
        err.code === "LIMIT_FILE_COUNT" ||
        (err.code === "LIMIT_UNEXPECTED_FILE" && err.field === "attachments")
      ) {
        return next(new BadRequestError(
          "You can attach at most 3 files."
        ));
      }

      // file kisi aur field naam se aayi ("file", "photo"…)
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new BadRequestError(
          'Only the "attachments" file field is allowed.'
        ));
      }

      // baaki Multer galtiyan — err.message nahi, apna fixed message
      return next(new BadRequestError("Invalid file upload."));
    }

    next(err);
  });
}

module.exports = { uploadAttachments };
