// controller ka kaam: req se data nikalo, service ko do, res bhejo
const taskService = require("../services/taskService");

// GET /tasks — logged-in user ke saare tasks JSON mein bhejo
async function getTasks(req, res, next) {
  try {
    // user id JWT se (authMiddleware) — query string ya body se nahi
    const tasks = await taskService.getAllTasks(req.user.id);

    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

// GET /tasks/:id — ek task id se dhoondo
async function getTask(req, res, next) {
  try {
    // await — jab tak database jawab na de, yahin ruko
    // id URL se, owner JWT se — dono milein tabhi task milega
    const task = await taskService.getTaskById(req.params.id, req.user.id);

    res.status(200).json(task);
  } catch (err) {
    // error ko central error handler ke paas bhejo
    next(err);
  }
}

// POST /tasks — body: { "title": "...", "completed": false }
async function createTask(req, res, next) {
  try {
    // validateCreateTask pehle hi check kar chuka hai — yahan title hamesha sahi hai
    // body se sirf title aur completed — body mein "user" bheja ho to bhi ignore hota hai
    const { title, completed } = req.body;

    // owner hamesha verified JWT se (authMiddleware ne req.user lagaya) — client par bharosa nahi
    const newTask = await taskService.createTask({ title, completed, user: req.user.id });

    // 201 = naya resource ban gaya
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
}

// PUT /tasks/:id — body: { "title": "...", "completed": true }
async function updateTask(req, res, next) {
  try {
    const task = await taskService.updateTask(req.params.id, req.user.id, req.body || {});

    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

// DELETE /tasks/:id
async function deleteTask(req, res, next) {
  try {
    const deletedTask = await taskService.deleteTask(req.params.id, req.user.id);

    res.status(200).json({ message: "Task deleted", task: deletedTask });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask
};
