const express = require("express");
const { uploadAttachments } = require("../config/ticketUpload");
const ticketController = require("../controllers/ticketController");
const { createTicketRules } = require("../validators/ticketValidators");
const { handleValidation } = require("../middleware/validate");
const discardTicketUploads = require("../middleware/discardTicketUploads");

// app.js mein "/tickets" par authMiddleware ke BAAD lagaya gaya hai — Multer ka filename req.user.id se banta hai
const router = express.Router();

router.get("/", ticketController.listTickets);
router.get("/:id", ticketController.getTicket);
router.get("/:id/attachments/:attachmentId", ticketController.downloadAttachment);
// Multer → validation (req.body Multer ke baad hi milta hai) → controller; koi bhi galti ho to aakhir mein temp files ka cleanup
router.post("/", uploadAttachments, createTicketRules, handleValidation, ticketController.createTicket, discardTicketUploads);

module.exports = router;
