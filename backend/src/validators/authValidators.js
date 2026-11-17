// register aur login ke rules — express-validator ki chains (har chain ek middleware hai)
const { requiredString } = require("./common");

// bcrypt sirf pehle 72 BYTES padhta hai — lamba password ho to 72 ke baad wala hissa koi bhi ho, login ho jaata
// isliye had bytes mein (characters nahi — "é" 2 bytes ka hai)
const MAX_PASSWORD_BYTES = 72;

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

// mazboot password ki shartein — custom validator: pehli toot-ti shart ka message throw karta hai
// (express-validator throw hua message hi error.msg bana deta hai — har shart ka apna saaf message)
// uppercase ki shart se "kam se kam ek letter" khud poori ho jaati hai — alag rule nahi
const PASSWORD_STRENGTH_RULES = [
  [/[A-Z]/, "Password must contain at least one uppercase letter"],
  // \d JavaScript mein sirf 0–9 hai
  [/\d/, "Password must contain at least one number"],
  // letter, number aur space ke ilawa koi bhi nishaan (!@#$%^&*… , . _ - waghaira)
  [/[^\p{L}\p{N}\s]/u, "Password must contain at least one special character (e.g. !@#$%)"]
];

function strongPassword(password) {
  for (const [pattern, message] of PASSWORD_STRENGTH_RULES) {
    if (!pattern.test(password)) {
      throw new Error(message);
    }
  }
  return true;
}

// naya password (register + verify-email) — 8+, 72 bytes tak, aage/peeche space nahi, uppercase + number + special
// password trim NAHI hota — spaces bhi password ka hissa hain; frontend (helpers.passwordRuleError) bhi yahi rules
// login par ye rules nahi — purane (kamzor) passwords wale users login kar sakein
// field/label — change-password par "newPassword" / "New password" (messages bhi usi naam se)
function newPasswordRule(field = "password", label = "Password") {
  return requiredString(field, label)
    .notEmpty().withMessage(`${label} is required`).bail()
    .isLength({ min: 8 }).withMessage(`${label} must be at least 8 characters`).bail()
    .custom(passwordNotTooLong).withMessage(`${label} must be at most ${MAX_PASSWORD_BYTES} bytes`).bail()
    // copy-paste mein aaya space user ko dikhta nahi, login par wo type nahi karta
    .custom((password) => password === password.trim()).withMessage(`${label} must not start or end with a space`).bail()
    .custom((password) => {
      try {
        return strongPassword(password);
      } catch (err) {
        // strongPassword ke messages "Password must…" se shuru — label badla ho to wahi naam
        throw new Error(err.message.replace(/^Password/, label));
      }
    });
}

// POST /auth/register
const registerRules = [emailRule(), newPasswordRule()];

// POST /auth/verify-email — email + bilkul 6 digit ka code (string; 123456 number nahi) + naya password
// password yahin account par lagta hai — is liye register wale hi rules (warna kamzor password verify par set ho jaata)
// email ka format nahi — galat email par service ka generic "Invalid or expired code" hi aata hai
const verifyEmailRules = [
  requiredString("email", "Email").trim().toLowerCase().notEmpty().withMessage("Email is required"),
  requiredString("otp", "Code").matches(/^\d{6}$/).withMessage("Code must be 6 digits"),
  newPasswordRule()
];

// maujooda password (login, ownership transfer) — naye password ke rules NAHI (purane passwords wale bhi chalein), sirf required + 72 bytes
function currentPasswordRule(field = "password", label = "Password") {
  return requiredString(field, label)
    .notEmpty().withMessage(`${label} is required`).bail()
    .custom(passwordNotTooLong).withMessage(`${label} must be at most ${MAX_PASSWORD_BYTES} bytes`);
}

// POST /auth/login
const loginRules = [emailRule(), currentPasswordRule()];

// POST /auth/login/request-otp — login jaise hi rules (email + password), code isi ke baad jaata hai
// POST /auth/login/verify-otp — request-otp ka loginToken (64 hex) + bilkul 6 digit ka code
// email/password nahi — password request-otp par check ho chuka, loginToken hi user batata hai
const verifyLoginOtpRules = [
  requiredString("loginToken", "Login token").matches(/^[a-f0-9]{64}$/).withMessage("Invalid login token"),
  requiredString("otp", "Code").matches(/^\d{6}$/).withMessage("Code must be 6 digits")
];

// POST /auth/reset-password — verify-email jaisa: email + 6 digit code + naya password (register wale rules)
const resetPasswordRules = [
  requiredString("email", "Email").trim().toLowerCase().notEmpty().withMessage("Email is required"),
  requiredString("otp", "Code").matches(/^\d{6}$/).withMessage("Code must be 6 digits"),
  newPasswordRule()
];

// POST /user/change-password — maujooda password (purane kamzor bhi chalein) + naya (register wale rules)
const changePasswordRules = [
  currentPasswordRule("currentPassword", "Current password"),
  newPasswordRule("newPassword", "New password")
];

module.exports = {
  registerRules,
  verifyEmailRules,
  loginRules,
  verifyLoginOtpRules,
  resetPasswordRules,
  changePasswordRules,
  emailRule,
  currentPasswordRule
};
