const express = require("express");
const taskController = require("../controllers/taskController");
const { validateCreateTask, validateUpdateTask } = require("../middleware/validation");

// app.js mein "/tasks" par lagaya gaya hai — isliye yahan "/" matlab "/tasks"
const router = express.Router();

router.get("/", taskController.getTasks);
router.get("/:id", taskController.getTask);
// left se right chalte hain — pehle validation, pass ho to controller
router.post("/", validateCreateTask, taskController.createTask);
// update par bhi validation — warna Mongoose "true"/1 ko true aur 123 ko "123" bana kar save kar deta
router.put("/:id", validateUpdateTask, taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

module.exports = router;
