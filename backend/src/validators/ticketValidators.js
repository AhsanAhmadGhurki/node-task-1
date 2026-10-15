// POST /tickets ke rules — multipart hai, is liye route mein Multer ke BAAD (req.body usi ke baad bharta hai)
const { requiredString } = require("./common");

// Ticket model ka minlength/maxlength bhi yahi; frontend (helpers.TICKET_TITLE_*) bhi
const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;

// trim pehle — had trim ke baad gini jaati hai, "   ab   " 5 characters nahi
const createTicketRules = [
  requiredString("title", "Title")
    .trim()
    .notEmpty().withMessage("Title is required").bail()
    .isLength({ min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH })
    .withMessage(`Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters`),
  requiredString("description", "Description")
    .trim()
    .notEmpty().withMessage("Description is required").bail()
    .isLength({ max: DESCRIPTION_MAX_LENGTH })
    .withMessage(`Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`)
];

module.exports = { createTicketRules };
