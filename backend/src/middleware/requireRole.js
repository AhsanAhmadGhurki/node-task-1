// org ke har route ka ek hi pehredaar — requireRole("admin") = is org mein admin ya us se upar
// controllers khud role kabhi nahi dekhte; kaun kya kar sakta hai, sirf yahan aur routes mein likha hai
// authMiddleware ke BAAD (req.user chahiye); org ki id hamesha req.params.orgId se
const orgService = require("../services/orgService");
const ForbiddenError = require("../utils/ForbiddenError");
const NotFoundError = require("../utils/NotFoundError");
const { ROLE_RANK } = require("../utils/roles");

function requireRole(minRole) {
  // galat role ka naam (typo) — server start hote hi pakda jaye, kisi request par chupke se sab ko ijazat nahi
  if (!(minRole in ROLE_RANK)) {
    throw new Error(`requireRole: unknown role "${minRole}"`);
  }

  return async function checkRole(req, res, next) {
    try {
      const membership = await orgService.findMembership(req.params.orgId, req.user.id);

      // member hi nahi (ya org hai hi nahi, ya id ghalat) — 404, 403 nahi: Org B ka hona bhi na pata chale
      if (!membership) {
        return next(new NotFoundError(orgService.ORG_NOT_FOUND));
      }

      // member hai lekin role chhota — ab 403 theek hai (org to woh pehle se dekh sakta hai)
      if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
        return next(new ForbiddenError(`This action needs the ${minRole} role or higher (your role: ${membership.role})`));
      }

      // aage (controller/service) ke liye — role dobara DB se nahi
      req.membership = { orgId: String(membership.org), role: membership.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireRole;
