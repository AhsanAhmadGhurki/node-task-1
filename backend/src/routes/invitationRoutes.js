const express = require("express");
const invitationController = require("../controllers/invitationController");
const authMiddleware = require("../middleware/auth");

// app.js mein "/invitations" par — email ke link wale routes (org id URL mein nahi, token hi pehchaan hai)
// GET sirf API key (invite page login se pehle bhi khulta hai); accept par token (authMiddleware) zaroori
const router = express.Router();

/**
 * @openapi
 * /invitations/{token}:
 *   get:
 *     tags: [Invitations]
 *     summary: Invite link ki jaanch (login ke bina)
 *     description: |
 *       Invite page ke liye — kis org mein, kis role mein, kab tak. Sirf API key chahiye.
 *       Anjaan token 404; accepted 409; replaced ya expired 410. tokenHash/ids kabhi nahi.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/InviteToken"
 *     responses:
 *       200:
 *         description: Invite chal raha hai
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invitation:
 *                   $ref: "#/components/schemas/InvitationPreview"
 *       401:
 *         $ref: "#/components/responses/ApiKeyUnauthorized"
 *       404:
 *         $ref: "#/components/responses/InvitationNotFound"
 *       409:
 *         $ref: "#/components/responses/InvitationAccepted"
 *       410:
 *         $ref: "#/components/responses/InvitationGone"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:token", invitationController.getInvitation);

/**
 * @openapi
 * /invitations/{token}/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Invite accept (login zaroori, wahi email)
 *     description: |
 *       Ek transaction mein: link ki jaanch, membership (invite wala role), invite "accepted". Sirf ek dafa.
 *       Logged-in user ka email invite wala na ho → 403. Pehle se member → 409.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/InviteToken"
 *     responses:
 *       200:
 *         description: Ab aap org ke member hain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invitation accepted
 *                 org:
 *                   $ref: "#/components/schemas/Organization"
 *                 role:
 *                   $ref: "#/components/schemas/Role"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Invite kisi aur email par bheja gaya tha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: This invitation was sent to a different email address. Log in with that email to accept it.
 *       404:
 *         $ref: "#/components/responses/InvitationNotFound"
 *       409:
 *         description: Pehle hi accept ho chuka, ya aap pehle se member hain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               accepted:
 *                 summary: Invite istemal ho chuka
 *                 value:
 *                   message: This invitation has already been accepted
 *               member:
 *                 summary: Pehle se member
 *                 value:
 *                   message: You are already a member of this organization
 *       410:
 *         $ref: "#/components/responses/InvitationGone"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.post("/:token/accept", authMiddleware, invitationController.acceptInvitation);

module.exports = router;
