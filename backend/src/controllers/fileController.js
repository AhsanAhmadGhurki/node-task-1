// GET /files/:fileId — file sirf owner ko, aur stream kar ke
const fs = require("fs");
const { pipeline } = require("stream/promises");
const fileService = require("../services/fileService");
const NotFoundError = require("../utils/NotFoundError");

// browser mein seedha dikh sakti hain (<img>, naye tab mein) — baaki hamesha download
// PDF inline nahi: PDF ke andar JavaScript/links ho sakte hain, viewer ka bharosa nahi — download hi safe
const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Content-Disposition header — filename ASCII (purane browsers) + filename* UTF-8 (Urdu/emoji naam)
// " \ aur control characters hata do, warna header toot jaata ya naya header ghus sakta (header injection)
function contentDisposition(type, filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function serveFile(req, res, next) {
  try {
    // signed link — fileAccess ne sig aur expiry check kar li, ownership link banate waqt dekhi thi: sirf "hai bhi?" (404)
    // token — 404 (nahi hai) ya 403 (kisi aur ki) yahin se; authMiddleware 401 pehle hi de chuka
    const { file, filePath } = req.signedFileAccess
      ? await fileService.getFileById(req.params.fileId)
      : await fileService.getFileForUser(req.params.fileId, req.user.id);

    // headers bhejne se PEHLE pata karo ke disk par file hai — baad mein error aaye to status badal nahi sakte
    // size bhi yahin se (Content-Length) — DB ki value par bharosa nahi, disk ki asli
    let stat;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      // DB mein record hai, disk par nahi — ENOENT ka message server ka poora path batata, is liye apna 404
      return next(new NotFoundError("File not found"));
    }

    // inline = browser mein dikhao (<img>, preview); attachment = "Save as" — ?download=1 se hamesha attachment
    const disposition = INLINE_TYPES.has(file.mimetype) && req.query.download !== "1" ? "inline" : "attachment";

    res.status(200);
    // Content-Type upload ke waqt magic bytes se pakka hua tha — extension ya user ke naam se andaza nahi
    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", contentDisposition(disposition, file.originalName));
    // private — beech ka koi proxy/CDN ye file cache kar ke doosre user ko na de de
    // no-store — logout ke baad browser cache se bhi na khule
    res.setHeader("Cache-Control", "private, no-store");
    // helmet ka nosniff pehle se laga hai — browser Content-Type ko andaze se HTML nahi banayega

    // createReadStream — file 64 KB ke tukdon mein padh kar bhejte hain, poori RAM mein kabhi nahi
    // (readFile se 2 MB × 100 requests = 200 MB memory; stream se har request ko sirf ek chhota buffer)
    // pipeline — client beech mein connection band kare to file ka handle bhi band, leak nahi
    await pipeline(fs.createReadStream(filePath), res);
  } catch (error) {
    // aadhi file ja chuki — ab JSON error nahi bhej sakte (ERR_HTTP_HEADERS_SENT), connection band karo
    if (res.headersSent) {
      res.destroy();
      return;
    }
    next(error);
  }
}

// POST /files/:fileId/signed-url — 10 minute ka link, <img src> / <a href> mein seedha (bina token)
// url "/files/..." hai — browser "/api" laga kar maangta hai (Vite proxy API key lagata hai)
async function createSignedUrl(req, res, next) {
  try {
    const { path, expiresAt } = await fileService.createSignedUrl(req.params.fileId, req.user.id);
    res.status(200).json({ url: path, expiresAt });
  } catch (error) {
    next(error);
  }
}

module.exports = { serveFile, createSignedUrl };
