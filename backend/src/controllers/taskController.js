// controller ka kaam: req se data nikalo, service ko do, res bhejo
const taskService = require("../services/taskService");

// GET /tasks — saare tasks JSON mein bhejo
async function getTasks(req, res, next) {
  try {
    const tasks = await taskService.getAllTasks();

    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

// GET /tasks/:id — ek task id se dhoondo
async function getTask(req, res, next) {
  try {
    // await — jab tak database jawab na de, yahin ruko
    const task = await taskService.getTaskById(req.params.id);

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
    const { title, completed } = req.body;

    const newTask = await taskService.createTask({ title, completed });

    // 201 = naya resource ban gaya
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
}

// PUT /tasks/:id — body: { "title": "...", "completed": true }
async function updateTask(req, res, next) {
  try {
    const task = await taskService.updateTask(req.params.id, req.body || {});

    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

// DELETE /tasks/:id
async function deleteTask(req, res, next) {
  try {
    const deletedTask = await taskService.deleteTask(req.params.id);

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
