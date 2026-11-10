const express = require("express");
const { uploadAttachments } = require("../config/ticketUpload");
const ticketController = require("../controllers/ticketController");
const { createTicketRules } = require("../validators/ticketValidators");
const { handleValidation } = require("../middleware/validate");
const discardTicketUploads = require("../middleware/discardTicketUploads");

// app.js mein "/tickets" par authMiddleware ke BAAD lagaya gaya hai — Multer ka filename req.user.id se banta hai
// docs: har route ko API key AUR token chahiye; kisi aur ka ticket 404 (403 nahi); tickets par rate limiter nahi (429 nahi)
const router = express.Router();

/**
 * @openapi
 * /tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: Apne saare tickets (naye pehle)
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Sirf logged-in user ke tickets (khaali ho to [])
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tickets:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Ticket"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   post:
 *     tags: [Tickets]
 *     summary: Naya support ticket (0–3 attachments)
 *     description: |
 *       Do tareeqe:
 *       - **`multipart/form-data`** — `title`, `description` aur 0–3 files field **`attachments`** mein (har file alag part, same naam)
 *       - **`application/json`** — sirf `title` aur `description` (bina files)
 *
 *       **Files ki had:**
 *       - zyada se zyada **3 files**
 *       - har file **2 MB** tak (2,097,152 bytes), sab mila kar **5 MB** tak
 *       - **Allowed types:** **JPEG** (`image/jpeg`), **PNG** (`image/png`), **WebP** (`image/webp`), **PDF** (`application/pdf`)
 *       - server file ke **asli bytes** (magic bytes) bhi check karta hai — declared type se na milein to 415
 *
 *       All-or-nothing: koi bhi galti ho to na ticket banta hai, na koi file disk par rehti hai.
 *       Har attachment ka `_id` hi `GET /files/{fileId}` ka fileId hai.
 *     # dono lazmi — API key (har route) AUR token; ek hi object mein dono = "aur" (alag objects hote to "ya")
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 description: Trim ke baad 5–100 characters
 *                 example: Login issue here
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Trim ke baad khaali nahi, 1000 characters tak
 *                 example: I cannot login to my account
 *               attachments:
 *                 type: array
 *                 maxItems: 3
 *                 description: 0–3 files — JPEG, PNG, WebP ya PDF; har ek 2 MB tak, kul 5 MB
 *                 items:
 *                   type: string
 *                   format: binary
 *           encoding:
 *             attachments:
 *               contentType: image/jpeg, image/png, image/webp, application/pdf
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 100
 *                 description: Trim ke baad 5–100 characters
 *                 example: Login issue here
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Trim ke baad khaali nahi, 1000 characters tak
 *                 example: I cannot login to my account
 *     responses:
 *       201:
 *         description: Ticket ban gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticket: { $ref: "#/components/schemas/Ticket" }
 *             examples:
 *               withAttachment:
 *                 summary: Ek PNG ke saath (multipart)
 *                 value:
 *                   ticket:
 *                     _id: 6af2d5733821c778011734b0
 *                     title: Login issue here
 *                     description: I cannot login
 *                     user: 6af2d5733821c778011734ad
 *                     attachments:
 *                       - _id: 6af2d5733821c778011734b1
 *                         originalName: a.png
 *                         mimetype: image/png
 *                         size: 100
 *                     createdAt: 2026-11-10T08:27:31.610Z
 *                     updatedAt: 2026-11-10T08:27:31.610Z
 *                     __v: 0
 *               noAttachments:
 *                 summary: Bina files (JSON ya multipart)
 *                 value:
 *                   ticket:
 *                     _id: 6af2d5733821c778011734b5
 *                     title: Login issue here
 *                     description: I cannot login
 *                     user: 6af2d5733821c778011734ad
 *                     attachments: []
 *                     createdAt: 2026-11-10T08:27:31.613Z
 *                     updatedAt: 2026-11-10T08:27:31.613Z
 *                     __v: 0
 *       400:
 *         description: Validation, ghalat file type/field/ginti, file ka naam 255 se lamba, ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               validation:
 *                 summary: Title chhota aur description khaali
 *                 value:
 *                   message: Title must be between 5 and 100 characters
 *                   errors:
 *                     - { field: title, message: Title must be between 5 and 100 characters }
 *                     - { field: description, message: Description is required }
 *               fileType:
 *                 summary: Declared type JPEG/PNG/WebP/PDF ke ilawa (jaise text/html)
 *                 value:
 *                   message: Attachments must be JPEG, PNG, WebP or PDF files.
 *               tooManyFiles:
 *                 summary: 3 se zyada files
 *                 value:
 *                   message: You can attach at most 3 files.
 *               wrongField:
 *                 summary: File "attachments" ke ilawa kisi field naam se
 *                 value:
 *                   message: Only the "attachments" file field is allowed.
 *               longFileName:
 *                 summary: File ka naam 255 characters se lamba
 *                 value:
 *                   message: Invalid originalName
 *               invalidUpload:
 *                 summary: Baaki multipart galtiyan
 *                 value:
 *                   message: Invalid file upload.
 *               invalidJson:
 *                 summary: JSON body kharab
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       413:
 *         description: Ek file 2 MB se badi, sab files mila kar 5 MB se zyada, ya JSON body 100 KB se badi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               fileTooLarge:
 *                 summary: Ek file 2 MB se badi
 *                 value:
 *                   message: Each attachment must be at most 2 MB.
 *               totalTooLarge:
 *                 summary: Sab files mila kar 5 MB se zyada
 *                 value:
 *                   message: All attachments combined must be at most 5 MB.
 *               jsonTooLarge:
 *                 summary: JSON body 100 KB se badi
 *                 value:
 *                   message: request entity too large
 *       415:
 *         description: File ke asli bytes (magic bytes) allowed type nahi, ya declared type se alag (jaise WebP ko image/png bata kar)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Each attachment must be a valid JPEG, PNG, WebP or PDF file.
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/", ticketController.listTickets);

/**
 * @openapi
 * /tickets/{id}:
 *   get:
 *     tags: [Tickets]
 *     summary: Ek ticket
 *     description: Attachment download yahan nahi — `GET /files/{fileId}` (attachment ka `_id`).
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/TicketId"
 *     responses:
 *       200:
 *         description: Ticket mil gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticket: { $ref: "#/components/schemas/Ticket" }
 *       400:
 *         $ref: "#/components/responses/InvalidId"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/TicketNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:id", ticketController.getTicket);
// attachment ka download yahan nahi — GET /files/:fileId (attachment._id hi fileId hai)
// Multer → validation (req.body Multer ke baad hi milta hai) → controller; koi bhi galti ho to aakhir mein temp files ka cleanup
router.post("/", uploadAttachments, createTicketRules, handleValidation, ticketController.createTicket, discardTicketUploads);

module.exports = router;
