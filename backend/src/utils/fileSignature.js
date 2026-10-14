// upload ki asli type — file ke shuru ke bytes (magic bytes) se, declared Content-Type par bharosa nahi
// avatar aur ticket attachments dono yahi check use karte hain (har ek apni allowlist aur message deta hai)
const { fromFile } = require("file-type");
const UnsupportedMediaTypeError = require("./UnsupportedMediaTypeError");

// pehchaan na ho (text/HTML), allowlist mein na ho, ya declared type se alag ho to 415
// declared se milana zaroori — Multer extension declared type se rakhta hai, to WebP ".png" naam se na bache
// message hamesha do — class ka default avatar wala hai
async function assertFileSignature(
  filePath,
  declaredMime,
  allowedMimes,
  message
) {
  const fileType = await fromFile(filePath);

  if (
    !fileType ||
    !allowedMimes.includes(fileType.mime) ||
    fileType.mime !== declaredMime
  ) {
    throw new UnsupportedMediaTypeError(message);
  }

  return fileType;
}

module.exports = { assertFileSignature };
