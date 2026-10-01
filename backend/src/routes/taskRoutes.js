const express = require("express");
const taskController = require("../controllers/taskController");
const { validateCreateTask } = require("../middleware/validation");

// app.js mein "/tasks" par lagaya gaya hai — isliye yahan "/" matlab "/tasks"
const router = express.Router();

router.get("/", taskController.getTasks);
router.get("/:id", taskController.getTask);
// left se right chalte hain — pehle validation, pass ho to controller
router.post("/", validateCreateTask, taskController.createTask);
router.put("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

module.exports = router;
