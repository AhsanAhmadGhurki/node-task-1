const express = require("express");
const fileController = require("../controllers/fileController");
const authMiddleware = require("../middleware/auth");
const fileAccess = require("../middleware/fileAccess");

// app.js mein "/files" par BINA authMiddleware — GET signed link se bhi chalta hai, is liye auth yahan har route par
// docs: kisi aur ki file 403 (tickets/tasks ke 404 ke ulat — task ki shart); ghalat id ki shakal 404 (400 nahi)
const router = express.Router();

/**
 * @openapi
 * /files/{fileId}/signed-url:
 *   post:
 *     tags: [Files]
 *     summary: 10 minute ka link — bina token ke file kholne ke liye (<img src>, <a href>)
 *     description: |
 *       Sirf file ka owner (avatar ka user, ya attachment wale ticket ka malik) bana sakta hai.
 *       Jawab ka `url` is server ke root se hai: `GET {url}` — sirf API key chahiye, token nahi.
 *       Link `fileId` aur expiry par HMAC se signed hai; kuch bhi badla to 403.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/FileId"
 *     responses:
 *       200:
 *         description: Link ban gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string, description: "/files/{fileId}?expires=<unix seconds>&sig=<HMAC>" }
 *                 expiresAt: { type: string, format: date-time }
 *             example:
 *               url: /files/6af2f044a99254255b674962?expires=1794306716&sig=MEqL4ljPLGDM39CPqi5e-T4UEjskYGN6hoq8OP-_ZMk
 *               expiresAt: 2026-11-10T10:31:56.000Z
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: File kisi aur ki hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: You do not have access to this file
 *       404:
 *         $ref: "#/components/responses/FileNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// POST /files/:fileId/signed-url — sirf token se, aur sirf owner (warna 403/404); { url, expiresAt } (10 minute)
router.post("/:fileId/signed-url", authMiddleware, fileController.createSignedUrl);

/**
 * @openapi
 * /files/{fileId}:
 *   get:
 *     tags: [Files]
 *     summary: File download / dikhana (avatar ya ticket attachment)
 *     description: |
 *       **Do raste** (security mein dono options):
 *       1. **Bearer token** — owner hi khol sakta hai (kisi aur ki file 403)
 *       2. **Signed link** — `POST /files/{fileId}/signed-url` ka `expires` + `sig`, token nahi chahiye (10 minute)
 *
 *       Tasveerein (JPEG/PNG/WebP) `inline` aati hain (browser mein dikhti hain), PDF hamesha `attachment` (download).
 *       `?download=1` se tasveer bhi download. File stream hoti hai; `Cache-Control: private, no-store`.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/FileId"
 *       - name: expires
 *         in: query
 *         required: false
 *         description: Signed link ki expiry (unix seconds) — sig ke saath hi
 *         schema: { type: integer, example: 1794306716 }
 *       - name: sig
 *         in: query
 *         required: false
 *         description: Signed link ka HMAC — expires ke saath hi
 *         schema: { type: string, example: MEqL4ljPLGDM39CPqi5e-T4UEjskYGN6hoq8OP-_ZMk }
 *       - name: download
 *         in: query
 *         required: false
 *         description: "1 = tasveer bhi download (Content-Disposition: attachment)"
 *         schema: { type: string, enum: ["1"] }
 *     responses:
 *       200:
 *         description: File ke bytes — Content-Type upload ke waqt asli bytes se pakka hua tha
 *         headers:
 *           Content-Disposition:
 *             description: inline (tasveer) ya attachment (PDF, ya ?download=1), asli file naam ke saath
 *             schema:
 *               type: string
 *               example: attachment; filename="doc.pdf"; filename*=UTF-8''doc.pdf
 *           Cache-Control:
 *             schema: { type: string, example: "private, no-store" }
 *         content:
 *           image/jpeg:
 *             schema: { type: string, format: binary }
 *           image/png:
 *             schema: { type: string, format: binary }
 *           image/webp:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Signed link ghalat/badla hua/expire, ya (token se) file kisi aur ki
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               badLink:
 *                 summary: expires/sig ghalat ya expire
 *                 value:
 *                   message: Invalid or expired file link
 *               notOwner:
 *                 summary: Token se — file kisi aur ki
 *                 value:
 *                   message: You do not have access to this file
 *       404:
 *         $ref: "#/components/responses/FileNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// GET /files/:fileId — token (owner check) YA ?expires=&sig= (signed link); stream kar ke
// ?download=1 — tasveer bhi "Save as" ho (Content-Disposition: attachment); signature mein nahi, sirf header badalta hai
router.get("/:fileId", fileAccess, fileController.serveFile);

module.exports = router;
