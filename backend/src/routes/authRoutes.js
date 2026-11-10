const express = require("express");
const authController = require("../controllers/authController");
const { validateEmail } = require("../middleware/validation");
const { registerRules, verifyEmailRules, loginRules, verifyLoginOtpRules } = require("../validators/authValidators");
const { handleValidation } = require("../middleware/validate");
const { registerLimiter, loginLimiter, resendLimiter, resendEmailCooldown, otpVerifyLimiter } = require("../middleware/rateLimit");

// app.js mein root ("/") par lagaya gaya hai — isliye yahan poore paths likhe hain
// saare auth routes /auth/* par; register, verify, resend ke purane root paths alias hain (purane clients na tootein)
// alias aur naya path ek hi route + ek hi limiter — dono raston ki ginti saath (alias se limit nahi bachti)
// docs: har route ke upar @openapi; dobara aane wale hisse ($ref) src/docs/components.yaml mein
// auth routes par token nahi lagta — sirf global ApiKeyAuth (openapi.js ki default security)
const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Naya account — email par verify ka 6-digit code
 *     description: |
 *       Account `isVerified: false` banta hai aur email par code jaata hai. Agla qadam: `POST /auth/verify-email`.
 *       Email pehle se **unverified** account ka ho to naya account nahi banta: 200 aur naya code (password nahi badalta).
 *       Purana path `POST /register` bhi yahi hai (same limiter).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.test
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 8+ characters, 72 bytes tak, ek capital (A–Z), ek number, ek special character, aage/peeche space nahi
 *                 example: Valid1234!
 *     responses:
 *       201:
 *         description: Naya account bana, code email par gaya
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *             example:
 *               _id: 6af2f02fa249d02b97a568ba
 *               email: user@example.test
 *               isVerified: false
 *               avatar: null
 *               name: null
 *               phone: null
 *               createdAt: 2026-11-10T10:21:35.727Z
 *               updatedAt: 2026-11-10T10:21:35.727Z
 *               __v: 0
 *       200:
 *         description: Email ka unverified account pehle se hai — naya code (ghante mein 3 ke baad chupke se nahi jaata, jawab wahi)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: If an account exists for this email, a verification code has been sent.
 *       400:
 *         description: Validation fail ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               validation:
 *                 summary: Ghalat email aur chhota password
 *                 value:
 *                   message: Please enter a valid email address
 *                   errors:
 *                     - { field: email, message: Please enter a valid email address }
 *                     - { field: password, message: Password must be at least 8 characters }
 *               weakPassword:
 *                 summary: Special character nahi
 *                 value:
 *                   message: Password must contain at least one special character (e.g. !@#$%)
 *                   errors:
 *                     - { field: password, message: Password must contain at least one special character (e.g. !@#$%) }
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       409:
 *         description: Email ka verified account pehle se hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Email already registered
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       429:
 *         description: Ek IP se ghante mein 10 registrations
 *         headers:
 *           Retry-After:
 *             $ref: "#/components/headers/RetryAfter"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RateLimitError"
 *             example:
 *               message: Too many accounts created from this network. Please try again later.
 *               retryAfter: 3412
 *               resetAt: 2026-11-10T11:18:27.000Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// register par password ke rules (8+ characters, ek number, 72 bytes tak) — login par nahi
// register asal email bhejta hai — ek IP se ghante mein had se zyada nahi
router.post(["/auth/register", "/register"], registerLimiter, registerRules, handleValidation, authController.register);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Register ke baad email ka code + password — verify aur seedha login
 *     description: |
 *       Password **yahin** account par lagta hai (register wala nahi), is liye register jaise password rules.
 *       Kamyab ho to login bhi: `token` body mein, refresh token `Set-Cookie` mein.
 *       Har galti ka ek hi 400 "Invalid or expired code" — account hai ya nahi, verified hai ya nahi, kuch nahi batata.
 *       Purana path `POST /verify-email` bhi yahi hai.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.test
 *               otp:
 *                 type: string
 *                 pattern: '^\d{6}$'
 *                 description: Email wala 6-digit code (string, number nahi). 5 minute, 5 koshishen
 *                 example: "482913"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Register jaise rules — yahi account ka password banta hai
 *                 example: Valid1234!
 *     responses:
 *       200:
 *         description: Email verify ho gaya aur login bhi
 *         headers:
 *           Set-Cookie:
 *             $ref: "#/components/headers/SetRefreshCookie"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Session"
 *             example:
 *               message: Email verified. You are now logged in.
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWYyZjAyZmEyNDlkMDJiOTdhNTY4YmEifQ.signature
 *               user:
 *                 _id: 6af2f02fa249d02b97a568ba
 *                 email: user@example.test
 *                 isVerified: true
 *                 avatar: null
 *                 name: null
 *                 phone: null
 *                 createdAt: 2026-11-10T10:21:35.727Z
 *                 updatedAt: 2026-11-10T10:21:36.422Z
 *                 __v: 0
 *       400:
 *         description: Ghalat/expire/istemal shuda code, na-maujood ya pehle se verified email, validation, ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               invalidCode:
 *                 summary: Code ghalat, expire, ya account ki koi bhi aur halat
 *                 value:
 *                   message: Invalid or expired code
 *               validation:
 *                 summary: Code 6 digit nahi, password kamzor
 *                 value:
 *                   message: Code must be 6 digits
 *                   errors:
 *                     - { field: otp, message: Code must be 6 digits }
 *                     - { field: password, message: Password must be at least 8 characters }
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       429:
 *         description: Ek IP se 15 minute mein 10 ghalat codes (verify-email aur login verify-otp mila kar)
 *         headers:
 *           Retry-After:
 *             $ref: "#/components/headers/RetryAfter"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RateLimitError"
 *             example:
 *               message: Too many failed code attempts. Please try again in 15 minutes.
 *               retryAfter: 871
 *               resetAt: 2026-11-10T10:36:12.000Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// code guess karna — har code par 5 koshishen DB mein, aur ye IP limit alag
router.post(["/auth/verify-email", "/verify-email"], otpVerifyLimiter, verifyEmailRules, handleValidation, authController.verifyEmail);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Email verify ka naya code (purana foran band)
 *     description: |
 *       200 ka jawab **hamesha ek** — account na ho, pehle se verified ho, code gaya ho, ya ghante ki had (3) poori ho.
 *       Is se koi pata nahi kar sakta ke email registered hai. Purana path `POST /resend-verification` bhi yahi hai.
 *       400 mein `errors` array nahi (purana validator), sirf `message`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.test
 *     responses:
 *       200:
 *         description: Hamesha yahi (account ho ya na ho)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: If that account exists and is not verified, a new verification code has been sent
 *       400:
 *         description: Email na ho, ghalat shakal, ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               missing:
 *                 summary: Email nahi bheja
 *                 value:
 *                   message: Email is required
 *               invalid:
 *                 summary: Email ki shakal ghalat
 *                 value:
 *                   message: Please enter a valid email address
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       429:
 *         description: Ek IP se 15 minute mein 5, ya ek email par 60 second mein 1 (account ho ya na ho)
 *         headers:
 *           Retry-After:
 *             $ref: "#/components/headers/RetryAfter"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RateLimitError"
 *             examples:
 *               emailCooldown:
 *                 summary: Ek email par 60 second mein dobara
 *                 value:
 *                   message: Please wait a minute before requesting another code.
 *                   retryAfter: 58
 *                   resetAt: 2026-11-10T10:22:35.000Z
 *               ipLimit:
 *                 summary: Ek IP se 15 minute mein 5
 *                 value:
 *                   message: Too many verification code requests. Please try again in 15 minutes.
 *                   retryAfter: 812
 *                   resetAt: 2026-11-10T10:35:13.000Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// naya code — har request email bhejti hai: IP limit (5/15 min), phir ek email par 60s cooldown,
// aur user ki 3/ghanta ginti DB mein alag
router.post(
  ["/auth/resend-verification", "/resend-verification"],
  resendLimiter,
  validateEmail,
  resendEmailCooldown,
  authController.resendVerification
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     deprecated: true
 *     summary: Band — sirf password wala login (2FA chhodne ka rasta tha)
 *     description: Hamesha 410. Login ab do qadam mein — `POST /auth/login/request-otp`, phir `POST /auth/login/verify-otp`.
 *     responses:
 *       410:
 *         description: Ye rasta band hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Password-only login is disabled. Use POST /auth/login/request-otp, then POST /auth/login/verify-otp.
 *       400:
 *         $ref: "#/components/responses/InvalidJson"
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 */
// purana password-only login band — 410 (404 nahi, taake purana client saaf jaane ke kya karna hai)
router.post("/auth/login", authController.loginDisabled);

/**
 * @openapi
 * /auth/login/request-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Login ka pehla qadam — password check, phir email par 6-digit code
 *     description: |
 *       Password sahi ho to email par code jaata hai aur jawab mein `loginToken` aata hai (access token abhi nahi).
 *       Code 5 minute chalta hai. Agla qadam: `POST /auth/login/verify-otp` with `{ loginToken, otp }`.
 *
 *       **Order** (jo pehle fail ho wahi jawab): API key (401) → IP limit (429) → validation (400) →
 *       email/password (401) → account lock (423) → email verified? (403) → ghante mein 10 codes (429) → 200.
 *
 *       **429 do soorton mein**, dono ki body ek hi shakal `{ message, retryAfter, resetAt }` (`RateLimitError`):
 *       - ek IP se 15 minute mein 50 **ghalat** koshishen
 *       - ek account par ghante mein 10 se zyada login codes
 *
 *       `retryAfter` = kitne **second** baad dobara koshish karein (wahi `Retry-After` header mein), `resetAt` = kab (ISO 8601, UTC).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Trim + lowercase hota hai (`" QA@X.com "` = `qa@x.com`)
 *                 example: user@example.test
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Khaali nahi, zyada se zyada 72 bytes
 *                 example: Valid1234!
 *     responses:
 *       200:
 *         description: Password sahi — code email par bhej diya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 loginToken: { type: string, description: "64 hex — sirf verify-otp ke saath; naya request-otp purana band kar deta hai" }
 *                 expiresInSeconds: { type: integer, description: Code kitni der chalega }
 *             example:
 *               message: A login code has been sent to your email.
 *               loginToken: 1e5c2a2a924dfc00db1144d6bb72b5f443c566a32cb407e6b22a94b01d85200d
 *               expiresInSeconds: 300
 *       400:
 *         description: Validation fail (har ghalat field `errors` mein, `message` pehli galti) ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               validation:
 *                 summary: Ghalat email aur khaali password
 *                 value:
 *                   message: Please enter a valid email address
 *                   errors:
 *                     - { field: email, message: Please enter a valid email address }
 *                     - { field: password, message: Password is required }
 *               notString:
 *                 summary: 'Field string nahi (jaise `{ "$ne": null }`)'
 *                 value:
 *                   message: Email must be a string
 *                   errors:
 *                     - { field: email, message: Email must be a string }
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         description: API key ghalat/na ho, ya email/password ghalat (na-maujood email ka bhi yahi jawab)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               wrongCredentials:
 *                 summary: Ghalat email ya password
 *                 value:
 *                   message: Invalid email or password
 *               apiKey:
 *                 summary: x-api-key ghalat ya na ho
 *                 value:
 *                   message: Invalid or missing API key
 *       403:
 *         description: Password sahi, lekin email verify nahi hua (code nahi jaata)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Please verify your email with the code we sent before logging in.
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       423:
 *         description: Lagataar 5 ghalat password — account 15 minute band (sahi password bhi nahi chalta)
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
 *               resetAt: 2026-11-10T08:42:18.221Z
 *       429:
 *         description: Had poori — body `RateLimitError` (`message`, `retryAfter` seconds, `resetAt` ISO time)
 *         headers:
 *           Retry-After:
 *             $ref: "#/components/headers/RetryAfter"
 *           RateLimit:
 *             description: IETF draft-8, jaise `"50-in-15min"; r=0; t=886` (r = baaki requests, t = seconds)
 *             schema: { type: string }
 *           RateLimit-Policy:
 *             description: IETF draft-8, jaise `"50-in-15min"; q=50; w=900`
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RateLimitError"
 *             examples:
 *               ipLimit:
 *                 summary: Ek IP se 15 minute mein 50 ghalat koshishen
 *                 value:
 *                   message: Too many failed login attempts from this network. Please try again in 15 minutes.
 *                   retryAfter: 886
 *                   resetAt: 2026-11-10T08:42:16.963Z
 *               codeLimit:
 *                 summary: Ek account par ghante mein 10 se zyada codes
 *                 value:
 *                   message: Too many codes requested. Please try again in 60 minutes.
 *                   retryAfter: 3598
 *                   resetAt: 2026-11-10T09:27:19.415Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// 2FA login — pehle password (code email par + loginToken), phir loginToken + code (tokens)
// login par limit — validation se pehle, taake khaali/ghalat body wali koshishen bhi ginein
// email ka spam: code sirf sahi password par, aur user ki 10/ghanta ginti DB mein (429 + retryAfter)
router.post("/auth/login/request-otp",loginLimiter, loginRules, handleValidation, authController.requestLoginOtp);

/**
 * @openapi
 * /auth/login/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Login ka doosra qadam — loginToken + email wala code se tokens
 *     description: |
 *       `loginToken` sirf `request-otp` ke jawab mein milta hai (sahi password ke baad), is liye sirf email jaanne wala
 *       kisi ka code nahi aazma sakta. Code 5 minute, 5 koshishen, ek hi dafa.
 *       Kamyab ho to `token` body mein — **Authorize → BearerAuth** mein daalein; refresh token `Set-Cookie` mein.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [loginToken, otp]
 *             properties:
 *               loginToken:
 *                 type: string
 *                 pattern: '^[a-f0-9]{64}$'
 *                 description: request-otp ka loginToken
 *                 example: 1e5c2a2a924dfc00db1144d6bb72b5f443c566a32cb407e6b22a94b01d85200d
 *               otp:
 *                 type: string
 *                 pattern: '^\d{6}$'
 *                 description: Email wala 6-digit code (string)
 *                 example: "482913"
 *     responses:
 *       200:
 *         description: Login ho gaya
 *         headers:
 *           Set-Cookie:
 *             $ref: "#/components/headers/SetRefreshCookie"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Session"
 *             example:
 *               message: Logged in
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWYyZjAyZmEyNDlkMDJiOTdhNTY4YmEifQ.signature
 *               user:
 *                 _id: 6af2f02fa249d02b97a568ba
 *                 email: user@example.test
 *                 isVerified: true
 *                 avatar: null
 *                 name: Ali Khan
 *                 phone: "03001234567"
 *                 createdAt: 2026-11-10T10:21:35.727Z
 *                 updatedAt: 2026-11-10T10:21:36.422Z
 *                 __v: 0
 *       400:
 *         description: Ghalat/expire/istemal shuda code, ghalat ya purana loginToken, validation, ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               invalidCode:
 *                 summary: Code ghalat/expire/istemal ho chuka, ya loginToken purana
 *                 value:
 *                   message: Invalid or expired code
 *               validation:
 *                 summary: loginToken aur code ki shakal ghalat
 *                 value:
 *                   message: Invalid login token
 *                   errors:
 *                     - { field: loginToken, message: Invalid login token }
 *                     - { field: otp, message: Code must be 6 digits }
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       429:
 *         description: Ek IP se 15 minute mein 10 ghalat codes (verify-email ke saath ek ginti)
 *         headers:
 *           Retry-After:
 *             $ref: "#/components/headers/RetryAfter"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RateLimitError"
 *             example:
 *               message: Too many failed code attempts. Please try again in 15 minutes.
 *               retryAfter: 871
 *               resetAt: 2026-11-10T10:36:12.000Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// code guess — wahi otpVerifyLimiter (verify-email ke saath ek ginti), aur har code par 5 koshishen DB mein
router.post("/auth/login/verify-otp", otpVerifyLimiter, verifyLoginOtpRules, handleValidation, authController.verifyLoginOtp);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Naya access token — refresh cookie se (rotation)
 *     description: |
 *       Body nahi. Refresh token `refreshToken` cookie (httpOnly, `Path=/auth`) mein jaata hai — browser khud bhejta hai,
 *       is liye Swagger mein login (verify-otp) ke baad yahi page se seedha chalta hai.
 *       Har refresh purana token band kar ke naya cookie deta hai. Band token 30 second baad dobara aaye to chori maan kar
 *       user ke saare refresh tokens band.
 *     responses:
 *       200:
 *         description: Naya access token aur naya refresh cookie
 *         headers:
 *           Set-Cookie:
 *             $ref: "#/components/headers/SetRefreshCookie"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: "#/components/schemas/User" }
 *             example:
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWYyZjAyZmEyNDlkMDJiOTdhNTY4YmEifQ.signature
 *               user:
 *                 _id: 6af2f02fa249d02b97a568ba
 *                 email: user@example.test
 *                 isVerified: true
 *                 avatar: null
 *                 name: null
 *                 phone: null
 *                 createdAt: 2026-11-10T10:21:35.727Z
 *                 updatedAt: 2026-11-10T10:21:36.422Z
 *                 __v: 0
 *       401:
 *         description: Cookie na ho, ghalat/expire/band token, ya user delete — ya API key ghalat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               sessionExpired:
 *                 summary: Refresh token kaam ka nahi
 *                 value:
 *                   message: Session expired. Please log in again.
 *               apiKey:
 *                 summary: x-api-key ghalat ya na ho
 *                 value:
 *                   message: Invalid or missing API key
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// body nahi chahiye — refresh token httpOnly cookie se aata hai
router.post("/auth/refresh", authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout — refresh token band aur cookie saaf
 *     description: Body nahi. Cookie na ho ya pehle hi band ho to bhi 200 (logout hamesha kamyab). Access token 15 minute tak chalta rehta hai.
 *     responses:
 *       200:
 *         description: Logged out — cookie mita di (Expires 1970)
 *         headers:
 *           Set-Cookie:
 *             description: Khaali refreshToken cookie, Expires=Thu, 01 Jan 1970
 *             schema:
 *               type: string
 *               example: refreshToken=; Path=/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Logged out
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.post("/auth/logout", authController.logout);

module.exports = router;
