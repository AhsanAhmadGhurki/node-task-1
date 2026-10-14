// support tickets ke handlers — sirf req/res; DB aur disk ka kaam ticketService mein
const ticketService = require("../services/ticketService");
const NotFoundError = require("../utils/NotFoundError");

// POST /tickets — multipart: title, description + 0–3 files (field "attachments")
// req.files — Multer temp folder mein rakh chuka; check, move aur DB service karti hai
async function createTicket(req, res, next) {
  try {
    const ticket = await ticketService.createTicket(
      req.user.id,
      {
        title: req.body.title,
        description: req.body.description
      },
      req.files || []
    );

    res.status(201).json({ ticket });
  } catch (error) {
    next(error);
  }
}

// GET /tickets — sirf apne tickets
async function listTickets(req, res, next) {
  try {
    const tickets = await ticketService.listTickets(req.user.id);
    res.status(200).json({ tickets });
  } catch (error) {
    next(error);
  }
}

// GET /tickets/:id — kisi aur ka ho to 404
async function getTicket(req, res, next) {
  try {
    const ticket = await ticketService.getTicket(
      req.params.id,
      req.user.id
    );

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
}

// GET /tickets/:id/attachments/:attachmentId — file user ke asli naam se download (Content-Disposition: attachment)
async function downloadAttachment(req, res, next) {
  try {
    const { filePath, originalName } =
      await ticketService.getAttachmentPath(
        req.params.id,
        req.params.attachmentId,
        req.user.id
      );

    res.download(filePath, originalName, (error) => {
      if (!error) return;
      // aadhi file ja chuki — ab jawab nahi badal sakte (errorHandler ka json ERR_HTTP_HEADERS_SENT deta), connection band karo
      if (res.headersSent) return res.destroy(error);
      // DB mein record hai lekin file disk par nahi — send ka ENOENT message server ka poora path batata hai
      // (errorHandler 4xx ka err.message bhej deta), is liye apna 404
      next(new NotFoundError("Attachment not found"));
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  downloadAttachment
};
