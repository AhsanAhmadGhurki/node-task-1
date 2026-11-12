const express = require("express");
const invitationController = require("../controllers/invitationController");
const requireRole = require("../middleware/requireRole");
const { sendInvitationRules } = require("../validators/orgValidators");
const { handleValidation } = require("../middleware/validate");

// orgRoutes mein "/:orgId/invitations" par — mergeParams se req.params.orgId (requireRole ko chahiye)
// har route par pehle requireRole — non-member ko har cheez 404 (ghalat body par bhi, 400 nahi)
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /orgs/{orgId}/invitations:
 *   get:
 *     tags: [Invitations]
 *     summary: Org ke pending invites (koi bhi member)
 *     description: Sirf pending. Expire ho chuke bhi aate hain, `expired true` ke saath. tokenHash kabhi nahi.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     responses:
 *       200:
 *         description: Pending invites (naye pehle)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invitations:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Invitation"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   post:
 *     tags: [Invitations]
 *     summary: Email se invite bhejna (owner, admin)
 *     description: |
 *       Email mein link `<FRONTEND_URL>/invitations/<token>` jaata hai — 48 ghante, ek dafa. DB mein sirf token ka SHA-256.
 *       - pehle se member → 409
 *       - usi email ka pending invite ho → purana "replaced" (us ka link band), naya link
 *       - owner role ka invite nahi (400); admin sirf member/viewer ko bula sakta hai (403)
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: new.person@example.test
 *               role:
 *                 type: string
 *                 enum: [admin, member, viewer]
 *                 example: member
 *     responses:
 *       201:
 *         description: Invite bana aur email bheji (devToken sirf EXPOSE_DEV_OTP=true, non-production)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation sent
 *                 invitation:
 *                   $ref: "#/components/schemas/Invitation"
 *                 devToken:
 *                   type: string
 *                   description: Sirf EXPOSE_DEV_OTP=true (non-production) — Postman/Newman ke liye link ka token
 *       400:
 *         description: Ghalat email ya role (owner bhi), ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ValidationError"
 *             example:
 *               message: "Role must be one of: admin, member, viewer"
 *               errors:
 *                 - field: role
 *                   message: "Role must be one of: admin, member, viewer"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Member/viewer (requireRole admin), ya admin kisi ko admin bana ke bula raha hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Your role (admin) can't invite someone as admin
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       409:
 *         description: Email pehle se member hai (ya isi waqt doosra invite bana)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: This email already belongs to a member of this organization
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/", requireRole("viewer"), invitationController.listInvitations);
router.post("/", requireRole("admin"), sendInvitationRules, handleValidation, invitationController.sendInvitation);

/**
 * @openapi
 * /orgs/{orgId}/invitations/{inviteId}:
 *   delete:
 *     tags: [Invitations]
 *     summary: Pending invite cancel (owner, admin)
 *     description: Link foran band. Sirf isi org ka pending invite — doosri org ka id, accepted ya anjaan → 404.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *       - $ref: "#/components/parameters/InviteId"
 *     responses:
 *       200:
 *         description: Invite cancel ho gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation cancelled
 *                 invitation:
 *                   $ref: "#/components/schemas/Invitation"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/RoleForbidden"
 *       404:
 *         $ref: "#/components/responses/OrgOrInvitationNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.delete("/:inviteId", requireRole("admin"), invitationController.cancelInvitation);

module.exports = router;
