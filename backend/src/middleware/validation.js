// request validation — controller tak pahunchne se pehle body check karo

// simple email shakal: kuch@kuch.kuch — spaces nahi, ek @, aur @ ke baad domain mein dot
// poori RFC wali validation nahi — asal saboot verification email hi hai
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// field na ho (undefined/null/khaali) to "required", ho lekin string na ho (object, array, number) to "must be a string"
// dono 400 hain — bas user ko saaf pata chale ke galti kya hai
// trim: email mein sirf spaces = khaali, password mein spaces bhi password ka hissa hain
function stringFieldError(value, field, { trim }) {
  if (value === undefined || value === null) {
    return `${field} is required`;
  }

  if (typeof value !== "string") {
    return `${field} must be a string`;
  }

  if ((trim ? value.trim() : value) === "") {
    return `${field} is required`;
  }

  return null;
}

// email ka missing / galat format — dono jagah (register, resend) ek hi rule
// error message lautata hai, sab theek ho to null
function emailError(email) {
  const fieldError = stringFieldError(email, "Email", { trim: true });
  if (fieldError) {
    return fieldError;
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return "Please enter a valid email address";
  }

  return null;
}

// task title ki had — warna 100kb tak ka title save ho jaata (DB bharo, UI todo); trim ke baad gina jaata hai
const MAX_TITLE_LENGTH = 200;

function titleError(title) {
  const fieldError = stringFieldError(title, "Title", { trim: true });
  if (fieldError) {
    return fieldError;
  }

  if (title.trim().length > MAX_TITLE_LENGTH) {
    return `Title must be at most ${MAX_TITLE_LENGTH} characters`;
  }

  return null;
}

// completed sirf asli boolean — "true", 1, null jaisi values Mongoose chupke se true/null bana deta tha
// bheja hi na ho (undefined) to theek — create par default false, update par woh field badalti hi nahi
function completedError(completed) {
  if (completed !== undefined && typeof completed !== "boolean") {
    return "Completed must be true or false";
  }

  return null;
}

// POST /tasks — title zaroori hai, completed optional
function validateCreateTask(req, res, next) {
  // body na bheji ho to Express 5 mein req.body undefined hota hai — isliye || {}
  const { title, completed } = req.body || {};

  // title na ho, string na ho, sirf spaces ho ya 200 se lamba ho to 400 — next() nahi chalega, controller tak nahi jayega
  const invalidTitle = titleError(title);
  if (invalidTitle) {
    return res.status(400).json({ message: invalidTitle });
  }

  const invalidCompleted = completedError(completed);
  if (invalidCompleted) {
    return res.status(400).json({ message: invalidCompleted });
  }

  // validation pass — ab controller chalao
  next();
}

// PUT /tasks/:id — partial update, lekin kam se kam ek field to ho
// jo field bheji hai woh create jaise hi rules par chale — 123 ka "123" ya null save na ho
function validateUpdateTask(req, res, next) {
  const { title, completed } = req.body || {};

  if (title === undefined && completed === undefined) {
    return res.status(400).json({ message: "Provide title or completed to update" });
  }

  if (title !== undefined) {
    // null bhi yahan aata hai — stringFieldError use "Title is required" deta hai
    const invalidTitle = titleError(title);
    if (invalidTitle) {
      return res.status(400).json({ message: invalidTitle });
    }
  }

  const invalidCompleted = completedError(completed);
  if (invalidCompleted) {
    return res.status(400).json({ message: invalidCompleted });
  }

  next();
}

// POST /resend-verification — sirf email chahiye, register wala hi rule
function validateEmail(req, res, next) {
  const { email } = req.body || {};

  const invalidEmail = emailError(email);
  if (invalidEmail) {
    return res.status(400).json({ message: invalidEmail });
  }

  next();
}

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  validateEmail
};
