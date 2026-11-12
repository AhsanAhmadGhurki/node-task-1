// org members ke controllers — sirf req/res; actor ka role requireRole se (req.membership), qaide memberService mein
const memberService = require("../services/memberService");

// GET /orgs/:orgId/members
async function listMembers(req, res, next) {
  try {
    const members = await memberService.listMembers(req.membership.orgId);
    res.status(200).json({ members });
  } catch (err) {
    next(err);
  }
}

// GET /orgs/:orgId/members/:userId
async function getMember(req, res, next) {
  try {
    const member = await memberService.getMember(req.membership.orgId, req.params.userId);
    res.status(200).json({ member });
  } catch (err) {
    next(err);
  }
}

// actor = request bhejne wala — id token se, role requireRole se (dobara DB nahi)
const actorOf = (req) => ({ id: req.user.id, role: req.membership.role });

// PATCH /orgs/:orgId/members/:userId/role — body { role }
async function changeRole(req, res, next) {
  try {
    const member = await memberService.changeRole(req.membership.orgId, actorOf(req), req.params.userId, req.body.role);
    res.status(200).json({ message: "Role updated", member });
  } catch (err) {
    next(err);
  }
}

// DELETE /orgs/:orgId/members/:userId
async function removeMember(req, res, next) {
  try {
    const removed = await memberService.removeMember(req.membership.orgId, actorOf(req), req.params.userId);
    res.status(200).json({ message: "Member removed", member: removed });
  } catch (err) {
    next(err);
  }
}

// POST /orgs/:orgId/leave
async function leaveOrg(req, res, next) {
  try {
    await memberService.leaveOrg(req.membership.orgId, actorOf(req));
    res.status(200).json({ message: "You left the organization" });
  } catch (err) {
    next(err);
  }
}

// POST /orgs/:orgId/transfer-ownership — body { newOwnerId, password }; password kabhi response/log mein nahi
async function transferOwnership(req, res, next) {
  try {
    const result = await memberService.transferOwnership(req.membership.orgId, actorOf(req), req.body.newOwnerId, req.body.password);
    res.status(200).json({ message: "Ownership transferred", ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMembers, getMember, changeRole, removeMember, leaveOrg, transferOwnership };
