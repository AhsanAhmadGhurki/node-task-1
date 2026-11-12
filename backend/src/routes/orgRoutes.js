const express = require("express");
const orgController = require("../controllers/orgController");
const requireRole = require("../middleware/requireRole");
const { createOrgRules, updateOrgRules, transferOwnershipRules } = require("../validators/orgValidators");
const { handleValidation } = require("../middleware/validate");
const memberRoutes = require("./memberRoutes");
const memberController = require("../controllers/memberController");
const orgInvitationRoutes = require("./orgInvitationRoutes");

// app.js mein "/orgs" par authMiddleware ke BAAD — har route ko token chahiye
// /orgs/:orgId ke neeche har route par requireRole — role ka check sirf wahan, controller mein kabhi nahi
// docs: non-member ko har cheez 404 (403 nahi); member ka role chhota ho to 403
const router = express.Router();

/**
 * @openapi
 * /orgs:
 *   get:
 *     tags: [Organizations]
 *     summary: Meri saari orgs, har ek mein mera role
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Sirf woh orgs jin ka user member hai (khaali ho to [])
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orgs:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: "#/components/schemas/Organization"
 *                       - type: object
 *                         properties:
 *                           role:
 *                             $ref: "#/components/schemas/Role"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   post:
 *     tags: [Organizations]
 *     summary: Nayi org — banane wala khud owner
 *     description: Koi bhi verified user org bana sakta hai. Banane wala us ka pehla **owner** banta hai.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Trim ke baad 2–100 characters
 *                 example: Acme Team
 *     responses:
 *       201:
 *         description: Org ban gayi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: "#/components/schemas/Organization"
 *                 role:
 *                   $ref: "#/components/schemas/Role"
 *       400:
 *         description: Naam na ho, string na ho, ya 2–100 se bahar; ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ValidationError"
 *             example:
 *               message: Name must be between 2 and 100 characters
 *               errors:
 *                 - field: name
 *                   message: Name must be between 2 and 100 characters
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/", orgController.listOrgs);
router.post("/", createOrgRules, handleValidation, orgController.createOrg);

/**
 * @openapi
 * /orgs/{orgId}:
 *   get:
 *     tags: [Organizations]
 *     summary: Ek org aur us mein mera role
 *     description: Koi bhi member (viewer bhi). Member nahi to 404 — chahe org maujood ho.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     responses:
 *       200:
 *         description: Org mili
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org:
 *                   $ref: "#/components/schemas/Organization"
 *                 role:
 *                   $ref: "#/components/schemas/Role"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   patch:
 *     tags: [Organizations]
 *     summary: Org ka naam badalna (owner, admin)
 *     description: Member aur viewer ko 403. Member hi nahi to 404.
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Trim ke baad 2–100 characters
 *                 example: Acme Team (Renamed)
 *     responses:
 *       200:
 *         description: Naam badal gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization updated
 *                 org:
 *                   $ref: "#/components/schemas/Organization"
 *       400:
 *         description: Naam khaali, string nahi, ya 2–100 se bahar; ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ValidationError"
 *             example:
 *               message: Name must be between 2 and 100 characters
 *               errors:
 *                 - field: name
 *                   message: Name must be between 2 and 100 characters
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/RoleForbidden"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   delete:
 *     tags: [Organizations]
 *     summary: Org delete (sirf owner)
 *     description: |
 *       Org, us ki saari memberships aur pending invitations **ek transaction** mein mitti hain —
 *       beech mein galti ho to kuch bhi nahi mitta. Admin, member, viewer ko 403; member hi nahi to 404.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     responses:
 *       200:
 *         description: Org aur us ka saara membership/invitation data mit gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Organization deleted
 *                 org:
 *                   $ref: "#/components/schemas/Organization"
 *                 deleted:
 *                   type: object
 *                   properties:
 *                     members:
 *                       type: integer
 *                       example: 4
 *                     invitations:
 *                       type: integer
 *                       example: 1
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/RoleForbidden"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:orgId", requireRole("viewer"), orgController.getOrg);
// requireRole PEHLE, validation baad mein — non-member ko ghalat naam par bhi 404 mile, 400 nahi (org ka hona na khule)
router.patch("/:orgId", requireRole("admin"), updateOrgRules, handleValidation, orgController.updateOrg);
router.delete("/:orgId", requireRole("owner"), orgController.deleteOrg);

// members ke routes alag file mein — requireRole wahan har route par
router.use("/:orgId/members", memberRoutes);
router.use("/:orgId/invitations", orgInvitationRoutes);

/**
 * @openapi
 * /orgs/{orgId}/leave:
 *   post:
 *     tags: [Members]
 *     summary: Khud org chhodna (koi bhi role)
 *     description: Ek transaction mein. Aakhri owner nahi chhod sakta (400) — pehle kisi aur ko owner banayein.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     responses:
 *       200:
 *         description: Org chhod di
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: You left the organization
 *       400:
 *         description: Aakhri owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: You are the last owner. Make another member an owner before leaving the organization.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       409:
 *         $ref: "#/components/responses/MemberChanged"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.post("/:orgId/leave", requireRole("viewer"), memberController.leaveOrg);

/**
 * @openapi
 * /orgs/{orgId}/transfer-ownership:
 *   post:
 *     tags: [Members]
 *     summary: Ownership kisi doosre member ko dena (sirf owner, password dobara)
 *     description: |
 *       Ek transaction mein: chuna hua member → **owner**, aap → **admin**. ownerCount wahi rehta hai.
 *       - password ghalat → 403 (login wali lockout ginti mein; 5 galtiyon par 423)
 *       - naya owner isi org ka member na ho (doosri org ka user bhi) → 404
 *       - khud ko, ya jo pehle se owner hai → 400
 *       - admin/member/viewer → 403; member hi nahi → 404
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
 *             required: [newOwnerId, password]
 *             properties:
 *               newOwnerId:
 *                 type: string
 *                 description: Naye owner ka user _id (isi org ka member)
 *                 example: 6af2f02fa249d02b97a568bb
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Aap (maujooda owner) ka password
 *                 example: Valid1234!
 *     responses:
 *       200:
 *         description: Ownership badal gayi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ownership transferred
 *                 newOwner:
 *                   $ref: "#/components/schemas/OrgMember"
 *                 previousOwner:
 *                   $ref: "#/components/schemas/OrgMember"
 *       400:
 *         description: Field missing, khud ko transfer, ya target pehle se owner
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               missing:
 *                 summary: Password nahi
 *                 value:
 *                   message: Password is required
 *                   errors:
 *                     - field: password
 *                       message: Password is required
 *               alreadyOwner:
 *                 summary: Target pehle se owner
 *                 value:
 *                   message: This member is already an owner
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Password ghalat, ya aap owner nahi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               password:
 *                 summary: Password ghalat
 *                 value:
 *                   message: Incorrect password
 *               role:
 *                 summary: Owner nahi
 *                 value:
 *                   message: "This action needs the owner role or higher (your role: admin)"
 *       404:
 *         $ref: "#/components/responses/OrgOrMemberNotFound"
 *       409:
 *         $ref: "#/components/responses/MemberChanged"
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
 *               resetAt: 2026-11-12T10:15:00.000Z
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// requireRole pehle — non-member ko (ghalat body par bhi) 404
router.post("/:orgId/transfer-ownership", requireRole("owner"), transferOwnershipRules, handleValidation, memberController.transferOwnership);

module.exports = router;
