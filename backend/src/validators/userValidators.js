// PATCH /user/profile ke rules — sirf name aur phone badal sakte hain
const { body } = require("express-validator");

// User model ka minlength/maxlength aur match bhi yahi
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
// Pakistani mobile — 03 se shuru, bilkul 11 digits (03XXXXXXXXX); spaces/dash nahi, +92 nahi
const PHONE_PATTERN = /^03\d{9}$/;

// sirf yahi fields — email, password, isVerified, avatar waghaira yahan se kabhi nahi badalte
const PROFILE_FIELDS = ["name", "phone"];

const updateProfileRules = [
  // poori body par — anjaan field chupke se ignore nahi, saaf 400 (user ko pata chale "email" yahan nahi badalta)
  body()
    .custom((profile) => {
      const unsupported = Object.keys(profile || {}).filter((key) => !PROFILE_FIELDS.includes(key));
      if (unsupported.length > 0) {
        throw new Error(`Unsupported field(s): ${unsupported.join(", ")}`);
      }
      return true;
    })
    .bail()
    // khaali update ka koi matlab nahi
    .custom((profile) => PROFILE_FIELDS.some((key) => profile?.[key] !== undefined))
    .withMessage("Provide name or phone to update"),

  // optional — bheja hi na ho to rule nahi chalta; null bheja to "must be a string"
  body("name")
    .optional()
    .isString().withMessage("Name must be a string").bail()
    .trim()
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`),

  body("phone")
    .optional()
    .isString().withMessage("Phone must be a string").bail()
    .trim()
    .matches(PHONE_PATTERN).withMessage("Phone must be in the format 03XXXXXXXXX (11 digits)")
];

module.exports = { updateProfileRules };
