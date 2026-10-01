// request validation — controller tak pahunchne se pehle body check karo

// POST /tasks — title zaroori hai
function validateCreateTask(req, res, next) {
  // body na bheji ho to Express 5 mein req.body undefined hota hai — isliye || {}
  const { title } = req.body || {};

  // title na ho, string na ho, ya sirf spaces ho to 400 — next() nahi chalega, controller tak nahi jayega
  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ message: "Title is required" });
  }

  // validation pass — ab controller chalao
  next();
}

module.exports = {
  validateCreateTask
};
