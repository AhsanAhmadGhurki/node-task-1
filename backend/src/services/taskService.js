// database ka saara kaam yahan — controller ko Mongoose ka pata hi nahi hona chahiye
// do qism ke tasks: personal (org: null, sirf user ka) aur workspace ke (org: <id>, org ke members ke)
// personal wali har query mein "org: null" — warna org ka task /tasks se bhi dikh jaata aur badla ja sakta
const Task = require("../models/Task");
const NotFoundError = require("../utils/NotFoundError");
const ForbiddenError = require("../utils/ForbiddenError");
const { canManageTask } = require("../utils/roles");

const TASK_NOT_FOUND = "Task not found";

// org route ki id — ghalat shakal par bhi 404 (CastError ka 400 nahi), baaki org routes jaisa
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// org ke task ke saath banane wale ki sirf ghair-hassas fields — list mein "kis ne banaya" dikhane ke liye
const CREATOR_FIELDS = "name email";

// ---------- personal tasks (/tasks) ----------

async function getAllTasks(userId) {
  // sirf is user ke personal tasks — doosre users ke, aur org ke tasks query mein aate hi nahi
  // createdAt se — pehle koi order tha hi nahi (MongoDB jaisa chahe), ab purane pehle, hamesha ek jaisa
  return Task.find({ user: userId, org: null }).sort({ createdAt: 1 });
}

async function getTaskById(id, userId) {
  // id aur owner dono match hon — doosre user ka task is query mein milta hi nahi
  const task = await Task.findOne({ _id: id, user: userId, org: null });

  // task nahi mila (ya kisi aur ka hai) to 404 — 403 nahi, taake pata na chale ke ye id maujood hai
  if (!task) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }

  return task;
}

async function createTask({ title, completed, user }) {
  // completed na bheja ho to schema ka default (false) lag jaata hai
  // _id MongoDB khud banata hai; org schema ke default se null (personal)
  // user = task ke owner ki id — controller req.user.id deta hai
  return Task.create({ title, completed, user });
}

// jo field bheji hai sirf wahi badlo — completed: false bhi valid value hai, isliye !== undefined
function changesOf({ title, completed }) {
  const updates = {};
  if (title !== undefined) {
    updates.title = title;
  }
  if (completed !== undefined) {
    updates.completed = completed;
  }
  return updates;
}

async function updateTask(id, userId, changes) {
  // sirf apna personal task update ho — kisi aur ka (ya org ka) ho to null aata hai
  const task = await Task.findOneAndUpdate({ _id: id, user: userId, org: null }, changesOf(changes), {
    // update ke baad wala task lautao, purana nahi
    returnDocument: "after",
    // update par bhi schema ke rules chalao — warna title: "" bhi save ho jaata
    runValidators: true
  });

  if (!task) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }

  return task;
}

async function deleteTask(id, userId) {
  // sirf apna personal task delete ho — delete karke wahi task lautata hai, na mile to null
  const deletedTask = await Task.findOneAndDelete({ _id: id, user: userId, org: null });

  if (!deletedTask) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }

  return deletedTask;
}

// ---------- workspace (org) ke tasks (/orgs/:orgId/tasks) ----------
// membership aur kam az kam role requireRole route par dekh chuka; yahan sirf "kis ka task" wala qaida
// har query { org: orgId } ke saath — Org A ke route se Org B ka task kabhi nahi milta (404)

// GET /orgs/:orgId/tasks — org ke saare tasks, purane pehle, banane wale ke saath
async function listOrgTasks(orgId) {
  return Task.find({ org: orgId }).sort({ createdAt: 1 }).populate("user", CREATOR_FIELDS);
}

// org ka ek task — id ghalat shakal ki, mila nahi, ya doosri org ka: sab 404
async function findOrgTask(orgId, taskId) {
  if (typeof taskId !== "string" || !OBJECT_ID.test(taskId)) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }
  const task = await Task.findOne({ _id: taskId, org: orgId });
  if (!task) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }
  return task;
}

// GET /orgs/:orgId/tasks/:taskId
async function getOrgTask(orgId, taskId) {
  const task = await findOrgTask(orgId, taskId);
  return task.populate("user", CREATOR_FIELDS);
}

// POST /orgs/:orgId/tasks — banane wala token se (body ka "user"/"org" kabhi nahi)
async function createOrgTask(orgId, userId, { title, completed }) {
  const task = await Task.create({ title, completed, user: userId, org: orgId });
  return task.populate("user", CREATOR_FIELDS);
}

// banane wale ka _id — populate hua ho ya na ho, dono shaklon mein
const creatorId = (task) => String(task.user?._id ?? task.user);

// PUT /orgs/:orgId/tasks/:taskId — actor = { id, role }
// completed: har member (route par member+); title: owner/admin har task ka, member sirf apne ka
async function updateOrgTask(orgId, actor, taskId, changes) {
  const task = await findOrgTask(orgId, taskId);

  if (changes.title !== undefined && !canManageTask(actor.role, creatorId(task) === actor.id)) {
    throw new ForbiddenError(`Your role (${actor.role}) can only rename tasks you created`);
  }

  // org shart dobara — beech mein task mit gaya ho to null (404), doosri org ka kabhi nahi
  const updated = await Task.findOneAndUpdate({ _id: task._id, org: orgId }, changesOf(changes), {
    returnDocument: "after",
    runValidators: true
  }).populate("user", CREATOR_FIELDS);

  if (!updated) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }
  return updated;
}

// DELETE /orgs/:orgId/tasks/:taskId — owner/admin har task, member sirf apna
async function deleteOrgTask(orgId, actor, taskId) {
  const task = await findOrgTask(orgId, taskId);

  if (!canManageTask(actor.role, creatorId(task) === actor.id)) {
    throw new ForbiddenError(`Your role (${actor.role}) can only delete tasks you created`);
  }

  const deleted = await Task.findOneAndDelete({ _id: task._id, org: orgId });
  if (!deleted) {
    throw new NotFoundError(TASK_NOT_FOUND);
  }
  return deleted;
}

module.exports = {
  TASK_NOT_FOUND,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  listOrgTasks,
  getOrgTask,
  createOrgTask,
  updateOrgTask,
  deleteOrgTask
};
