const express = require("express");
const orgTaskController = require("../controllers/orgTaskController");
const requireRole = require("../middleware/requireRole");
const { validateCreateTask, validateUpdateTask } = require("../middleware/validation");

// orgRoutes mein "/:orgId/tasks" par — mergeParams se req.params.orgId (requireRole ko chahiye)
// har route par pehle requireRole — non-member ko har cheez 404 (ghalat body par bhi 400 nahi, org ka hona na khule)
// validators personal tasks wale hi (title 200 tak, completed sirf boolean) — 400 mein sirf { message }
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /orgs/{orgId}/tasks:
 *   get:
 *     tags: [Org Tasks]
 *     summary: Org ke saare tasks (koi bhi member, viewer bhi)
 *     description: Purane pehle. `user` = banane wala (name, email); account mit chuka ho to null.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/OrgId"
 *     responses:
 *       200:
 *         description: Org ke tasks (khaali ho to [])
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/OrgTask"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   post:
 *     tags: [Org Tasks]
 *     summary: Org mein naya task (member, admin, owner)
 *     description: Banane wala hamesha token se. Viewer ko 403.
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
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: Prepare the release notes
 *               completed:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Task ban gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   $ref: "#/components/schemas/OrgTask"
 *       400:
 *         description: Validation (pehli galti, sirf message) ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Title is required
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Viewer task nahi bana sakta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: "This action needs the member role or higher (your role: viewer)"
 *       404:
 *         $ref: "#/components/responses/OrgNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/", requireRole("viewer"), orgTaskController.listTasks);
router.post("/", requireRole("member"), validateCreateTask, orgTaskController.createTask);

/**
 * @openapi
 * /orgs/{orgId}/tasks/{taskId}:
 *   parameters:
 *     - $ref: "#/components/parameters/OrgId"
 *     - $ref: "#/components/parameters/OrgTaskId"
 *   get:
 *     tags: [Org Tasks]
 *     summary: Org ka ek task (koi bhi member)
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Task mil gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   $ref: "#/components/schemas/OrgTask"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/OrgOrTaskNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   put:
 *     tags: [Org Tasks]
 *     summary: Task badalna — done/pending har member, naam sirf apna (admin/owner har task ka)
 *     description: |
 *       Sirf bheji hui fields badalti hain (`completed false` bhi). Kam az kam ek chahiye.
 *       - `completed`: member, admin, owner — kisi ka bhi task
 *       - `title`: owner/admin har task ka; member sirf apne banaye task ka (warna 403)
 *       - viewer: 403
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
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: Prepare the release notes (v2)
 *               completed:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Badla hua task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   $ref: "#/components/schemas/OrgTask"
 *       400:
 *         description: Koi field nahi, ya ghalat title/completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Provide title or completed to update
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Viewer, ya member kisi aur ka task ka naam badal raha hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               viewer:
 *                 summary: Viewer
 *                 value:
 *                   message: "This action needs the member role or higher (your role: viewer)"
 *               notCreator:
 *                 summary: Member, doosre ka task
 *                 value:
 *                   message: Your role (member) can only rename tasks you created
 *       404:
 *         $ref: "#/components/responses/OrgOrTaskNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   delete:
 *     tags: [Org Tasks]
 *     summary: Task mitana — admin/owner har task, member sirf apna
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Task mit gaya
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task deleted
 *                 task:
 *                   $ref: "#/components/schemas/OrgTask"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         description: Viewer, ya member kisi aur ka task mita raha hai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             example:
 *               message: Your role (member) can only delete tasks you created
 *       404:
 *         $ref: "#/components/responses/OrgOrTaskNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:taskId", requireRole("viewer"), orgTaskController.getTask);
router.put("/:taskId", requireRole("member"), validateUpdateTask, orgTaskController.updateTask);
router.delete("/:taskId", requireRole("member"), orgTaskController.deleteTask);

module.exports = router;
