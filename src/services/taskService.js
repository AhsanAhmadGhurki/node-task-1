// database ka saara kaam yahan — controller ko Mongoose ka pata hi nahi hona chahiye
const Task = require("../models/Task");
const NotFoundError = require("../utils/NotFoundError");

async function getAllTasks() {
  // {} = koi filter nahi — collection ke saare documents
  return Task.find({});
}

async function getTaskById(id) {
  const task = await Task.findById(id);

  // task nahi mila to error throw karo — controller ka catch pakad lega
  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return task;
}

async function createTask({ title, completed }) {
  // completed na bheja ho to schema ka default (false) lag jaata hai
  // _id MongoDB khud banata hai
  return Task.create({ title, completed });
}

async function updateTask(id, { title, completed }) {
  // jo field bheji hai sirf wahi badlo — completed: false bhi valid value hai, isliye !== undefined
  const updates = {};
  if (title !== undefined) {
    updates.title = title;
  }
  if (completed !== undefined) {
    updates.completed = completed;
  }

  const task = await Task.findByIdAndUpdate(id, updates, {
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

async function deleteTask(id) {
  // delete karke wahi task lautata hai — na mile to null
  const deletedTask = await Task.findByIdAndDelete(id);

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
