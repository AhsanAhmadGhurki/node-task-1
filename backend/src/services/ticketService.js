// support tickets ka DB aur disk ka kaam — controller ko Mongoose ya fs ka pata nahi hona chahiye
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Ticket = require("../models/Ticket");
const NotFoundError = require("../utils/NotFoundError");
const PayloadTooLargeError = require("../utils/PayloadTooLargeError");
const { assertFileSignature } = require("../utils/fileSignature");
const config = require("../config");

// final folder na ho to bana do — pehli ticket par rename "ENOENT" na de (temp folder ticketUpload.js banata hai)
fs.mkdirSync(config.ticketAttachmentDir, { recursive: true });

// sab attachments mila kar 5 MB — Multer har file ki had (2 MB) lagata hai, total ki nahi, is liye yahan
const MAX_TOTAL_SIZE = 5 * 1024 * 1024;

// ticketUpload.js ke allowedTypes jaisi hi list — asli bytes isi se milaye jaate hain
const ALLOWED_ATTACHMENT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

// temp folder (uploads/tmp/tickets) ki files mitao — request reject hui to Multer ki likhi files peeche na rahen
// file object (req.files) ya seedha naam, dono chalte hain
async function discardFiles(files = []) {
  await Promise.all(
    files.map(async (file) => {
      // Sirf basename use karo taake path folder se bahar na ja sake
      const filename = path.basename(file.filename || file);
      const filePath = path.join(config.ticketUploadTmpDir, filename);

      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        // File pehle hi delete ho chuki ho to cleanup continue rakho
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    })
  );
}

// ticket banao — pehle SAARI files check, phir move, phir DB (all-or-nothing)
// files — Multer ki req.files (temp folder mein); koi check fail ho to yahan se error, temp files route ka cleanup mitata hai
async function createTicket(userId, { title, description }, files = []) {
  // Tamam attachments ka combined size check karo
  const totalSize = files.reduce((total, file) => total + file.size, 0);

  if (totalSize > MAX_TOTAL_SIZE) {
    throw new PayloadTooLargeError(
      "All attachments combined must be at most 5 MB."
    );
  }

  // Har file ki actual signature aur declared MIME match verify karo
  for (const file of files) {
    await assertFileSignature(
      file.path,
      file.mimetype,
      ALLOWED_ATTACHMENT_MIMES,
      "Each attachment must be a valid JPEG, PNG, WebP or PDF file."
    );
  }

  // File move karne se pehle ticket ID generate karo
  const ticketId = new mongoose.Types.ObjectId();
  const movedFiles = [];

  try {
    const attachments = [];

    for (const file of files) {
      // Stored filename server-generated hai; original filename sirf display ke liye hai
      const storedName = path.basename(file.filename);
      const destination = path.join(
        config.ticketAttachmentDir,
        storedName
      );

      await fs.promises.rename(file.path, destination);
      movedFiles.push(destination);

      attachments.push({
        storedName,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });
    }

    // Database record tab create karo jab tamam files move ho chuki hon
    return await Ticket.create({
      _id: ticketId,
      title,
      description,
      user: userId,
      attachments
    });
  } catch (error) {
    // DB ya file move fail ho to pehle se move ki hui files hatao
    await Promise.all(
      movedFiles.map(async (filePath) => {
        try {
          await fs.promises.unlink(filePath);
        } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") {
            // Original error ko preserve karte hue cleanup failure log karo
            console.error("Ticket attachment cleanup failed:", cleanupError.code);
          }
        }
      })
    );

    throw error;
  }
}

// sirf is user ke tickets, naye pehle — doosre users ke tickets query mein aate hi nahi
async function listTickets(userId) {
  return Ticket.find({ user: userId }).sort({ createdAt: -1 });
}

// id aur owner dono match hon — doosre user ka ticket ho to bhi 404 (403 nahi), taake pata na chale ke id maujood hai
// galat id ("abc") par Mongoose CastError deta hai — errorHandler use 400 bana deta hai
async function getTicket(id, userId) {
  const ticket = await Ticket.findOne({ _id: id, user: userId });

  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  return ticket;
}

// download ke liye file ka path — ticket apna ho aur attachment usi ticket ki ho, warna 404
async function getAttachmentPath(ticketId, attachmentId, userId) {
  // Pehle ownership verify karo; doosre user ke ticket ki attachment expose nahi honi chahiye
  // (getTicket wahi check — owner match na ho to "Ticket not found" 404)
  const ticket = await getTicket(ticketId, userId);

  // Sirf isi ticket ki attachment ID accept karo
  const attachment = ticket.attachments.id(attachmentId);

  if (!attachment) {
    throw new NotFoundError("Attachment not found");
  }

  // Stored filename server-generated hai; basename se directory traversal roko
  const storedName = path.basename(attachment.storedName);
  const filePath = path.join(config.ticketAttachmentDir, storedName);

  return {
    filePath,
    originalName: attachment.originalName
  };
}

module.exports = {
  createTicket,
  discardFiles,
  listTickets,
  getTicket,
  getAttachmentPath
};
