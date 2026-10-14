// POST /tickets ka aakhri (error) middleware — Multer ke baad koi bhi galti ho (validation, 413 total, 415 bytes, DB),
// temp folder ki files yahin mitti hain, taake rejected request ki koi file disk par na rahe (all-or-nothing)
// Multer apni galtiyon par (size, count, fileFilter) khud mita deta hai; kamyab request mein files pehle hi move ho chuki
const ticketService = require("../services/ticketService");

async function discardTicketUploads(err, req, res, next) {
  try {
    await ticketService.discardFiles(req.files || []);
  } catch (cleanupError) {
    // cleanup ki galti asal jawab (400/413/415) ko 500 na banaye — sirf code log karo
    console.error("Ticket upload cleanup failed:", cleanupError.code);
  }

  next(err);
}

module.exports = discardTicketUploads;
