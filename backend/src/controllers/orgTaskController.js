// workspace (org) ke tasks — sirf req/res; org aur role requireRole se (req.membership), qaide taskService mein
const taskService = require("../services/taskService");

// actor = request bhejne wala — id token se, role requireRole se (dobara DB nahi)
const actorOf = (req) => ({ id: req.user.id, role: req.membership.role });

// GET /orgs/:orgId/tasks
async function listTasks(req, res, next) {
  try {
    const tasks = await taskService.listOrgTasks(req.membership.orgId);
    res.status(200).json({ tasks });
  } catch (err) {
    next(err);
  }
}

// GET /orgs/:orgId/tasks/:taskId
async function getTask(req, res, next) {
  try {
    const task = await taskService.getOrgTask(req.membership.orgId, req.params.taskId);
    res.status(200).json({ task });
  } catch (err) {
    next(err);
  }
}

// POST /orgs/:orgId/tasks — body se sirf title/completed; "user" aur "org" body se kabhi nahi
async function createTask(req, res, next) {
  try {
    const { title, completed } = req.body;
    const task = await taskService.createOrgTask(req.membership.orgId, req.user.id, { title, completed });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

// PUT /orgs/:orgId/tasks/:taskId — body { title?, completed? }
async function updateTask(req, res, next) {
  try {
    const { title, completed } = req.body || {};
    const task = await taskService.updateOrgTask(req.membership.orgId, actorOf(req), req.params.taskId, { title, completed });
    res.status(200).json({ task });
  } catch (err) {
    next(err);
  }
}

// DELETE /orgs/:orgId/tasks/:taskId
async function deleteTask(req, res, next) {
  try {
    const task = await taskService.deleteOrgTask(req.membership.orgId, actorOf(req), req.params.taskId);
    res.status(200).json({ message: "Task deleted", task });
  } catch (err) {
    next(err);
  }
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask };
