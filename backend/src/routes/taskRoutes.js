const express = require("express");
const taskController = require("../controllers/taskController");
const { validateCreateTask, validateUpdateTask } = require("../middleware/validation");

// app.js mein "/tasks" par lagaya gaya hai — isliye yahan "/" matlab "/tasks"
// docs: har route ko API key AUR token chahiye (security mein dono ek hi item mein = "aur")
// task validators purane hand-written hain — 400 mein sirf { message }, errors array nahi
// kisi aur ka task 404 deta hai (403 nahi) — id ka hona bhi pata na chale
const router = express.Router();

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Apne saare tasks
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Sirf logged-in user ke tasks (khaali ho to [])
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Task"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   post:
 *     tags: [Tasks]
 *     summary: Naya task
 *     description: Owner hamesha token se — body mein `user` bheja ho to bhi ignore.
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
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
 *                 description: Trim ke baad khaali nahi, 200 characters tak
 *                 example: Buy milk
 *               completed:
 *                 type: boolean
 *                 default: false
 *                 description: Sirf asli true/false ("true" ya 1 nahi)
 *                 example: false
 *     responses:
 *       201:
 *         description: Task ban gaya
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Task"
 *       400:
 *         description: Validation (pehli galti, sirf message) ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               titleMissing:
 *                 summary: Title nahi, null, ya sirf spaces
 *                 value:
 *                   message: Title is required
 *               titleNotString:
 *                 summary: Title string nahi (jaise 123)
 *                 value:
 *                   message: Title must be a string
 *               titleTooLong:
 *                 summary: Title 200 se lamba
 *                 value:
 *                   message: Title must be at most 200 characters
 *               completedInvalid:
 *                 summary: 'completed boolean nahi (jaise "yes")'
 *                 value:
 *                   message: Completed must be true or false
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/", taskController.getTasks);

/**
 * @openapi
 * /tasks/{id}:
 *   parameters:
 *     - $ref: "#/components/parameters/TaskId"
 *   get:
 *     tags: [Tasks]
 *     summary: Ek task
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Task mil gaya
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Task"
 *       400:
 *         $ref: "#/components/responses/InvalidId"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/TaskNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   put:
 *     tags: [Tasks]
 *     summary: Task badlo (partial — sirf bheji hui fields)
 *     description: Kam se kam ek field (`title` ya `completed`). `completed false` bhi asli tabdeeli hai.
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
 *                 example: Buy milk and eggs
 *               completed:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Badla hua task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Task"
 *             example:
 *               _id: 6af2f031a249d02b97a568c0
 *               title: Buy milk
 *               completed: true
 *               user: 6af2f02fa249d02b97a568ba
 *               createdAt: 2026-11-10T10:21:37.119Z
 *               updatedAt: 2026-11-10T10:21:37.151Z
 *               __v: 0
 *       400:
 *         description: Koi field nahi, ghalat field, ghalat id, ya kharab JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *             examples:
 *               nothingToUpdate:
 *                 summary: Na title na completed
 *                 value:
 *                   message: Provide title or completed to update
 *               titleTooLong:
 *                 summary: Title 200 se lamba
 *                 value:
 *                   message: Title must be at most 200 characters
 *               completedInvalid:
 *                 summary: completed boolean nahi
 *                 value:
 *                   message: Completed must be true or false
 *               invalidId:
 *                 summary: id 24 hex nahi
 *                 value:
 *                   message: Invalid _id
 *               invalidJson:
 *                 summary: Body JSON hi nahi
 *                 value:
 *                   message: Invalid JSON in request body
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/TaskNotFound"
 *       413:
 *         $ref: "#/components/responses/JsonTooLarge"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 *   delete:
 *     tags: [Tasks]
 *     summary: Task mitao
 *     security:
 *       - ApiKeyAuth: []
 *         BearerAuth: []
 *     responses:
 *       200:
 *         description: Mit gaya — mita hua task bhi wapas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Task deleted }
 *                 task: { $ref: "#/components/schemas/Task" }
 *       400:
 *         $ref: "#/components/responses/InvalidId"
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/TaskNotFound"
 *       500:
 *         $ref: "#/components/responses/ServerError"
 */
router.get("/:id", taskController.getTask);
// left se right chalte hain — pehle validation, pass ho to controller
router.post("/", validateCreateTask, taskController.createTask);
// update par bhi validation — warna Mongoose "true"/1 ko true aur 123 ko "123" bana kar save kar deta
router.put("/:id", validateUpdateTask, taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

module.exports = router;
