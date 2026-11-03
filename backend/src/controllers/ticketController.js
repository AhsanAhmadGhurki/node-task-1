// support tickets ke handlers — sirf req/res; DB aur disk ka kaam ticketService mein
const ticketService = require("../services/ticketService");

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

module.exports = {
  createTicket,
  listTickets,
  getTicket
};
