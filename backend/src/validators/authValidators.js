// register aur login ke rules — express-validator ki chains (har chain ek middleware hai)
const { body } = require("express-validator");

// bcrypt sirf pehle 72 BYTES padhta hai — lamba password ho to 72 ke baad wala hissa koi bhi ho, login ho jaata
// isliye had bytes mein (characters nahi — "é" 2 bytes ka hai)
const MAX_PASSWORD_BYTES = 72;

// missing/null aur ghair-string ({ "$ne": null }, array, number) — isString pehle, warna trim() object ko
// "[object Object]" string bana kar aage bhej deta
function requiredString(field, label) {
  return body(field)
    .exists({ values: "null" }).withMessage(`${label} is required`).bail()
    .isString().withMessage(`${label} must be a string`).bail();
}

// trim + lowercase — "  Test@Email.com  " DB tak "test@email.com" pahunche (controller ko saaf value milti hai)
// normalizeEmail() nahi — woh Gmail ke dots aur +tags hata deta hai, jo alag mailbox ho sakte hain
// DB ka unique index (User model) phir bhi zaroori — validation do ek saath aane wali requests nahi rok sakti
function emailRule() {
  return requiredString("email", "Email")
    .trim()
    .toLowerCase()
    .notEmpty().withMessage("Email is required").bail()
    .isEmail().withMessage("Please enter a valid email address");
}

const passwordNotTooLong = (password) => Buffer.byteLength(password, "utf8") <= MAX_PASSWORD_BYTES;

// naya password (register) — 8+, 72 bytes tak, aage/peeche space nahi, ek letter, ek number
// password trim NAHI hota — spaces bhi password ka hissa hain; frontend (helpers.passwordRuleError) bhi yahi rules
function newPasswordRule() {
  return requiredString("password", "Password")
    .notEmpty().withMessage("Password is required").bail()
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters").bail()
    .custom(passwordNotTooLong).withMessage(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`).bail()
    // copy-paste mein aaya space user ko dikhta nahi, login par wo type nahi karta
    .custom((password) => password === password.trim()).withMessage("Password must not start or end with a space").bail()
    // \p{L} = koi bhi letter (a-z, é, ب …) — sirf ASCII nahi
    .matches(/\p{L}/u).withMessage("Password must contain at least one letter").bail()
    .matches(/\d/).withMessage("Password must contain at least one number");
}

// POST /auth/register
const registerRules = [emailRule(), newPasswordRule()];

// POST /auth/login — password ke naye rules NAHI (purane passwords wale users login kar sakein), sirf required + 72 bytes
const loginRules = [
  emailRule(),
  requiredString("password", "Password")
    .notEmpty().withMessage("Password is required").bail()
    .custom(passwordNotTooLong).withMessage(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`)
];

module.exports = { registerRules, loginRules };
