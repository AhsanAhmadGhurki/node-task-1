// org routes ke rules
const { requiredString } = require("./common");
const { ROLES, INVITABLE_ROLES } = require("../utils/roles");
// register/login wala hi email qaida (trim + lowercase + isEmail) — invite bhi usi shakal mein save ho
const { emailRule, currentPasswordRule } = require("./authValidators");

// Organization model ka minlength/maxlength bhi yahi
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

// naam ka ek hi qaida — banate waqt aur rename par (trim ke baad 2–100; khaali "   " bhi 400)
const nameRule = () =>
  requiredString("name", "Name")
    .trim()
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);

const createOrgRules = [nameRule()];

// PATCH /orgs/:orgId — abhi sirf naam badalta hai, is liye naam lazmi
const updateOrgRules = [nameRule()];

// PATCH .../members/:userId/role — sirf chaar roles; kaun kise kya bana sakta hai, woh memberService (403)
const changeRoleRules = [
  requiredString("role", "Role")
    .isIn(ROLES)
    .withMessage(`Role must be one of: ${ROLES.join(", ")}`)
];

// POST /orgs/:orgId/invitations — owner kabhi invite se nahi (400); admin kise invite kar sakta hai, woh service (403)
const sendInvitationRules = [
  emailRule(),
  requiredString("role", "Role")
    .isIn(INVITABLE_ROLES)
    .withMessage(`Role must be one of: ${INVITABLE_ROLES.join(", ")}`)
];

// POST /orgs/:orgId/transfer-ownership — naya owner (user id) + apna password dobara
// id ki shakal yahan nahi — ghalat id par 404 (memberService), non-member jaisa
const transferOwnershipRules = [
  requiredString("newOwnerId", "New owner").notEmpty().withMessage("New owner is required"),
  currentPasswordRule()
];

module.exports = { createOrgRules, updateOrgRules, changeRoleRules, sendInvitationRules, transferOwnershipRules };
