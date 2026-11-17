const express = require("express");
const upload = require("../config/upload");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");
const { updateProfileRules } = require("../validators/userValidators");
const { changePasswordRules } = require("../validators/authValidators");
const { handleValidation } = require("../middleware/validate");

// app.js mein "/user" par authMiddleware ke BAAD lagaya gaya hai — yahan har route logged-in user ka
// (upload.js filename ke liye req.user.id chahiye — isliye auth yahan dobara nahi, app.js mein pehle)
// docs: har route ko API key AUR token chahiye
const router = express.Router();

/**
 * @openapi
 * /user/upload-avatar:
 *   post:
 *     tags: [User]
 *     summary: Profile picture upload (purani khud mit jaati hai)
 *     description: |
 *       `multipart/form-data`, **ek** file field `avatar` mein.
 *
 *       - **Had:** zyada se zyada **2 MB** (2,097,152 bytes) — is se badi par 413
 *       - **Allowed types:** sirf **JPEG** (`image/jpeg`), **PNG** (`image/png`), **WebP** (`image/webp`) — SVG, GIF, PDF, HTML nahi
 *       - Server file ke **asli bytes** (magic bytes) bhi check karta hai: bytes type se na milein (jaise `.png` naam ki HTML) to 415
 *       - File ka naam server rakhta hai, aapka naam sirf download ke liye
 *
 *       Jawab ka `avatar` ek fileId hai — tasveer `GET /files/{fileId}` se.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG ya WebP — 2 MB tak
 *           encoding:
 *             avatar:
 *               contentType: image/jpeg, image/png, image/webp
 *     responses:
 *       200:
 *         description: Avatar lag gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 avatar: { type: string, description: Naya fileId }
 *             example:
 *               message: Avatar uploaded successfully
 *               avatar: 6af2f031a249d02b97a568c1
 *       400:
 *         description: File nahi, ghalat type, ghalat field, ya ek se zyada file — disk par kuch nahi rehta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               missing:
 *                 summary: avatar field mein file nahi
 *                 value:
 *                   message: Avatar file is required
 *               wrongType:
 *                 summary: Declared type JPEG/PNG/WebP nahi (jaise text/html, image/svg+xml)
 *                 value:
 *                   message: Avatar must be a JPEG, PNG or WebP image.
 *               wrongField:
 *                 summary: File "avatar" ke ilawa kisi field naam se
 *                 value:
 *                   message: Only the "avatar" file field is allowed.
 *               tooManyFiles:
 *                 summary: Do files ek saath (ya baaki multipart galtiyan)
 *                 value:
 *                   message: Invalid file upload.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/UserNotFound"
 *       413:
 *         description: File 2 MB se badi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Avatar file is too large. Maximum size is 2 MB.
 *       415:
 *         description: Asli bytes JPEG/PNG/WebP nahi, ya declared type se alag (jaise WebP ko image/png bata kar)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Avatar must be a valid JPEG, PNG or WebP image.
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// POST /user/upload-avatar — multipart/form-data, file field ka naam "avatar"
router.post(
  "/upload-avatar",
  upload.single("avatar"),
  userController.uploadAvatar
);

/**
 * @openapi
 * /user/profile:
 *   get:
 *     tags: [User]
 *     summary: Apni profile (DB se taaza)
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: "#/components/schemas/User" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/UserNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   patch:
 *     tags: [User]
 *     summary: Naam aur/ya phone badlo
 *     description: Sirf `name` aur `phone` — koi aur field (`email`, `isVerified`, `password`…) 400 deti hai, chupke se ignore nahi hoti.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             additionalProperties: false
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: Trim ke baad 2–50 characters
 *                 example: Ali Khan
 *               phone:
 *                 type: string
 *                 pattern: '^03\d{9}$'
 *                 description: Pakistani mobile — 03XXXXXXXXX, bilkul 11 digits (spaces, dash, +92 nahi)
 *                 example: "03001234567"
 *     responses:
 *       200:
 *         description: Profile badal gayi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Profile updated successfully }
 *                 user: { $ref: "#/components/schemas/User" }
 *       400:
 *         description: Validation (har ghalat field `errors` mein) ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               fields:
 *                 summary: Naam chhota, phone ghalat
 *                 value:
 *                   message: Name must be between 2 and 50 characters
 *                   errors:
 *                     - { field: name, message: Name must be between 2 and 50 characters }
 *                     - { field: phone, message: Phone must be in the format 03XXXXXXXXX (11 digits) }
 *               unsupported:
 *                 summary: Anjaan field (jaise email)
 *                 value:
 *                   message: "Unsupported field(s): email"
 *                   errors:
 *                     - { field: body, message: "Unsupported field(s): email" }
 *               empty:
 *                 summary: Na name na phone
 *                 value:
 *                   message: Provide name or phone to update
 *                   errors:
 *                     - { field: body, message: Provide name or phone to update }
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/UserNotFound"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// GET /user/profile — apni profile (email, name, phone, avatar)
router.get("/profile", userController.getProfile);

// PATCH /user/profile — JSON body: name aur/ya phone (partial update)
router.patch("/profile", updateProfileRules, handleValidation, userController.updateProfile);

/**
 * @openapi
 * /user/change-password:
 *   post:
 *     tags: [User]
 *     summary: Password badalna (logged-in) — baqi devices logout
 *     description: |
 *       Maujooda password dobara (login wali lockout ginti: 5 ghalat par 423). Naya password register wale qaidon par,
 *       aur maujooda se alag. Kamyabi par saare refresh tokens mit jaate hain aur pehle bane access tokens rad —
 *       **yeh device** naya `token` aur nayi refresh cookie paata hai, baqi devices logout.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: Valid1234!
 *               newPassword:
 *                 type: string
 *                 description: 8+, uppercase, number, special character, 72 bytes tak
 *                 example: NewValid1234!
 *     responses:
 *       200:
 *         description: Password badal gaya — naya token (body) aur refresh cookie
 *         headers:
 *           Set-Cookie:
 *             $ref: "#/components/headers/SetRefreshCookie"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Session"
 *             example:
 *               message: Your password has been changed. Other devices have been logged out.
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWYyZjAyZmEyNDlkMDJiOTdhNTY4YmEifQ.signature
 *               user:
 *                 _id: 6af2f02fa249d02b97a568ba
 *                 email: user@example.test
 *                 isVerified: true
 *                 avatar: null
 *                 name: Ali Khan
 *       400:
 *         description: Validation, ya naya password purane jaisa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ValidationError"
 *             examples:
 *               weak:
 *                 summary: Naya password kamzor
 *                 value:
 *                   message: New password must be at least 8 characters
 *                   errors:
 *                     - field: newPassword
 *                       message: New password must be at least 8 characters
 *               same:
 *                 summary: Naya wahi purana
 *                 value:
 *                   message: New password must be different from your current password
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Maujooda password ghalat (401 nahi — token theek hai)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Incorrect password
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       423:
 *         description: Bahut galat passwords — account 15 minute band (login jaisa)
 *         headers:
 *           Retry-After:
 *             $ref: "#/components/headers/RetryAfter"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RateLimitError"
 *             example:
 *               message: Account locked due to too many failed login attempts. Try again in 15 minutes.
 *               retryAfter: 900
 *               resetAt: 2026-11-17T10:40:00.000Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// controller authController mein — refresh cookie wahi lagata hai (cookie ka Path /auth hai, kisi bhi route se lag sakti hai)
router.post("/change-password", changePasswordRules, handleValidation, authController.changePassword);

module.exports = router;
