// sab validators ki shared chains
const { body } = require("express-validator");

// missing/null aur ghair-string ({ "$ne": null }, array, number) — isString pehle, warna trim() object ko
// "[object Object]" string bana kar aage bhej deta
function requiredString(field, label) {
  return body(field)
    .exists({ values: "null" }).withMessage(`${label} is required`).bail()
    .isString().withMessage(`${label} must be a string`).bail();
}

module.exports = { requiredString };
