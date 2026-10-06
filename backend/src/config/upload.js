// avatar upload ki Multer settings — file disk par, naam server banata hai
const multer = require("multer");
const fs = require("fs");
const config = require("./index");
const BadRequestError = require("../utils/BadRequestError");

// backend/uploads/avatars/ — DB mein sirf yahan ki file ka path jaata hai (User.avatar)
const uploadDir = config.avatarUploadDir;

// folder na ho to bana do — pehli upload par "ENOENT" na aaye
fs.mkdirSync(uploadDir, { recursive: true });

// sirf ye tasveerein — aur extension inhi se, user ke file naam se nahi
// (warna "evil.html" → ".html" file banti, jo serve hone par browser HTML ki tarah chalata — XSS)
// note: mimetype client ka bataya hua Content-Type hai, file ke andar ke bytes check nahi hote
const allowedTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  // naam: <userId>-<time><ext> — user ka diya hua naam (originalname) kabhi nahi, ext mimetype se:
  // usme "../" ya doosre user ki file ka naam ho sakta hai, aur do uploads ek doosre ko overwrite kar sakti hain
  // req.user — authMiddleware is se PEHLE lagna zaroori hai
  filename: (req, file, cb) => {
    const userId = req.user.id;
    const timestamp = Date.now();
    // fileFilter pehle chal chuka — yahan sirf allowedTypes wali mimetype aati hai
    const extension = allowedTypes[file.mimetype];

    cb(null, `${userId}-${timestamp}${extension}`);
  }
});

const upload = multer({
  storage,
  // had na ho to koi bhi bahut badi file bhej kar disk bhar sakta hai
  limits: {
    // 2 MB — avatar ke liye kaafi
    fileSize: 2 * 1024 * 1024,
    // ek request mein ek hi file
    files: 1
  },
  // jpeg/png/webp ke ilawa (html, svg, pdf…) — disk par likhne se PEHLE reject
  // apni error class — errorHandler ka statusCode wala raasta 400 + yahi message bhejta hai
  // (MulterError "LIMIT_UNEXPECTED_FILE" nahi — uska message "galat field" kehta, jo yahan jhoot hota)
  fileFilter: (req, file, cb) => {
    if (!allowedTypes[file.mimetype]) {
      return cb(new BadRequestError("Avatar must be a JPEG, PNG or WebP image."));
    }

    cb(null, true);
  }
});

module.exports = upload;
