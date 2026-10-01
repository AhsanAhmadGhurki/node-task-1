// database ka saara kaam yahan — controller ko Mongoose ka pata hi nahi hona chahiye
const Task = require("../models/Task");
const NotFoundError = require("../utils/NotFoundError");

async function getAllTasks(userId) {
  // sirf is user ke tasks — doosre users ke tasks query mein aate hi nahi
  return Task.find({ user: userId });
}

async function getTaskById(id, userId) {
  // id aur owner dono match hon — doosre user ka task is query mein milta hi nahi
  const task = await Task.findOne({ _id: id, user: userId });

  // task nahi mila (ya kisi aur ka hai) to 404 — 403 nahi, taake pata na chale ke ye id maujood hai
  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return task;
}

async function createTask({ title, completed, user }) {
  // completed na bheja ho to schema ka default (false) lag jaata hai
  // _id MongoDB khud banata hai
  // user = task ke owner ki id — controller req.user.id deta hai
  return Task.create({ title, completed, user });
}

async function updateTask(id, userId, { title, completed }) {
  // jo field bheji hai sirf wahi badlo — completed: false bhi valid value hai, isliye !== undefined
  const updates = {};
  if (title !== undefined) {
    updates.title = title;
  }
  if (completed !== undefined) {
    updates.completed = completed;
  }

  // sirf apna task update ho — kisi aur ka ho to null aata hai
  const task = await Task.findOneAndUpdate({ _id: id, user: userId }, updates, {
    // update ke baad wala task lautao, purana nahi
    returnDocument: "after",
    // update par bhi schema ke rules chalao — warna title: "" bhi save ho jaata
    runValidators: true
  });

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return task;
}

async function deleteTask(id, userId) {
  // sirf apna task delete ho — delete karke wahi task lautata hai, na mile (ya kisi aur ka ho) to null
  const deletedTask = await Task.findOneAndDelete({ _id: id, user: userId });

  if (!deletedTask) {
    throw new NotFoundError("Task not found");
  }

  return deletedTask;
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
