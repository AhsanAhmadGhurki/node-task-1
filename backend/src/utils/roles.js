// org ke roles — ek jagah; models (enum) aur requireRole middleware dono yahin se
// order matter karta hai: upar wala zyada taaqatwar (requireRole("admin") = admin ya owner)
const ROLES = ["owner", "admin", "member", "viewer"];

// owner = 3 ... viewer = 0 — "kam az kam admin" jaise check ek number se
const ROLE_RANK = Object.fromEntries(ROLES.map((role, i) => [role, ROLES.length - 1 - i]));

// invite se owner nahi banta — owner sirf maujooda member ko banaya jaata hai (promote/transfer)
const INVITABLE_ROLES = ["admin", "member", "viewer"];

module.exports = { ROLES, ROLE_RANK, INVITABLE_ROLES };
