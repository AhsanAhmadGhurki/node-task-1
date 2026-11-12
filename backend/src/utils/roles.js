// org ke roles aur un ke qaide — ek jagah; models (enum), requireRole aur memberService sab yahin se
// order matter karta hai: upar wala zyada taaqatwar (requireRole("admin") = admin ya owner)
const ROLES = ["owner", "admin", "member", "viewer"];

// owner = 3 ... viewer = 0 — "kam az kam admin" jaise check ek number se
const ROLE_RANK = Object.fromEntries(ROLES.map((role, i) => [role, ROLES.length - 1 - i]));

// invite se owner nahi banta — owner sirf maujooda member ko banaya jaata hai (promote/transfer)
const INVITABLE_ROLES = ["admin", "member", "viewer"];

// --- member par kaam ke qaide (README ki permission matrix) ---
// requireRole sirf request bhejne wale (actor) ka role dekhta hai; ye do functions TARGET member ka role bhi —
// "admin owner ko nahi chhed sakta" jaisa qaida target ke bina ho hi nahi sakta. controller in ko kabhi nahi bulata.

// actor is member ka role badal ya use nikaal sakta hai? owner sab ko; admin sirf member/viewer ko
function canManageMember(actorRole, targetRole) {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole === "member" || targetRole === "viewer";
  return false;
}

// actor kisi ko ye role de sakta hai? owner koi bhi (owner bhi); admin sirf member/viewer
function canAssignRole(actorRole, role) {
  if (actorRole === "owner") return ROLES.includes(role);
  if (actorRole === "admin") return role === "member" || role === "viewer";
  return false;
}

module.exports = { ROLES, ROLE_RANK, INVITABLE_ROLES, canManageMember, canAssignRole };
