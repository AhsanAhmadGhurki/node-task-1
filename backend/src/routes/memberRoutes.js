const express = require("express");
const memberController = require("../controllers/memberController");
const requireRole = require("../middleware/requireRole");
const { changeRoleRules } = require("../validators/orgValidators");
const { handleValidation } = require("../middleware/validate");

// orgRoutes mein "/:orgId/members" par lagta hai — mergeParams se req.params.orgId yahan bhi (requireRole ko chahiye)
// har route par pehle requireRole — non-member ko har cheez 404
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /orgs/{orgId}/members:
 *   get:
 *     tags: [Members]
 *     summary: Org ke saare members (koi bhi member dekh sakta hai)
 *     description: Owners pehle, phir admin, member, viewer. Member hi nahi to 404.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     responses:
 *       200:
 *         description: Members ki list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/OrgMember"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/", requireRole("viewer"), memberController.listMembers);

/**
 * @openapi
 * /orgs/{orgId}/members/{userId}:
 *   get:
 *     tags: [Members]
 *     summary: Ek member ki tafseel
 *     description: User isi org ka member na ho (chahe doosri org mein ho) to 404 "Member not found".
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *       - $ref: "#/components/parameters/UserId"
 *     responses:
 *       200:
 *         description: Member mila
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   $ref: "#/components/schemas/OrgMember"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgOrMemberNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:userId", requireRole("viewer"), memberController.getMember);

/**
 * @openapi
 * /orgs/{orgId}/members/{userId}:
 *   delete:
 *     tags: [Members]
 *     summary: Member ko nikaalna (owner sab ko; admin sirf member/viewer ko)
 *     description: |
 *       Ek transaction mein. Aakhri owner nahi nikal sakta (400). Khud ko nikaalne ke liye `POST /orgs/{orgId}/leave`.
 *       Member/viewer ko 403 (requireRole admin).
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *       - $ref: "#/components/parameters/UserId"
 *     responses:
 *       200:
 *         description: Member nikal gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member removed
 *                 member:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: string
 *                       example: 6af2f02fa249d02b97a568ba
 *                     role:
 *                       $ref: "#/components/schemas/Role"
 *       400:
 *         description: Aakhri owner, ya khud ko nikaalne ki koshish
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               lastOwner:
 *                 summary: Aakhri owner
 *                 value:
 *                   message: An organization must always have at least one owner. Make another member an owner before removing this one.
 *               self:
 *                 summary: Khud ko
 *                 value:
 *                   message: You can't remove yourself. Use POST /orgs/:orgId/leave to leave the organization.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Role chhota (member/viewer), ya admin kisi owner/admin ko nikaal raha hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Your role (admin) can't remove an owner
 *       404:
 *         $ref: "#/components/responses/OrgOrMemberNotFound"
 *       409:
 *         $ref: "#/components/responses/MemberChanged"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.delete("/:userId", requireRole("admin"), memberController.removeMember);

/**
 * @openapi
 * /orgs/{orgId}/members/{userId}/role:
 *   patch:
 *     tags: [Members]
 *     summary: Member ka role badalna
 *     description: |
 *       Ek transaction mein (ownerCount bhi saath badalta hai).
 *       - **owner** kisi ka bhi role kuch bhi kar sakta hai (owner bana sakta hai, khud ko bhi demote — agar doosra owner ho)
 *       - **admin** sirf member ↔ viewer; owner/admin ko nahi chhed sakta, kisi ko admin/owner nahi bana sakta
 *       - member/viewer → 403
 *
 *       Aakhri owner demote nahi ho sakta (400).
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *       - $ref: "#/components/parameters/UserId"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 $ref: "#/components/schemas/Role"
 *     responses:
 *       200:
 *         description: Role badal gaya (wahi role dobara bhejein to bhi 200, kuch nahi badalta)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Role updated
 *                 member:
 *                   $ref: "#/components/schemas/OrgMember"
 *       400:
 *         description: Ghalat role, ya aakhri owner ka demote
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: "#/components/schemas/ValidationError"
 *                 - $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               invalidRole:
 *                 summary: Role chaar mein se nahi
 *                 value:
 *                   message: "Role must be one of: owner, admin, member, viewer"
 *                   errors:
 *                     - field: role
 *                       message: "Role must be one of: owner, admin, member, viewer"
 *               lastOwner:
 *                 summary: Aakhri owner
 *                 value:
 *                   message: An organization must always have at least one owner. Make another member an owner before changing this role.
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Role chhota, admin owner/admin ko chhed raha hai, ya admin kisi ko admin/owner bana raha hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Your role (admin) can't make someone owner
 *       404:
 *         $ref: "#/components/responses/OrgOrMemberNotFound"
 *       409:
 *         $ref: "#/components/responses/MemberChanged"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
// requireRole pehle — non-member ko ghalat role par bhi 404 (400 nahi)
router.patch("/:userId/role", requireRole("admin"), changeRoleRules, handleValidation, memberController.changeRole);

module.exports = router;
