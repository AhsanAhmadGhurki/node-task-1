// org ke controllers — sirf req/res; role ka check requireRole kar chuka (req.membership)
const orgService = require("../services/orgService");

// POST /orgs — body { name }
async function createOrg(req, res, next) {
  try {
    const { org, role } = await orgService.createOrg({ userId: req.user.id, name: req.body.name });
    res.status(201).json({ org, role });
  } catch (err) {
    next(err);
  }
}

// GET /orgs — meri saari orgs, har ek mein mera role
async function listOrgs(req, res, next) {
  try {
    const orgs = await orgService.listMyOrgs(req.user.id);
    res.status(200).json({ orgs });
  } catch (err) {
    next(err);
  }
}

// GET /orgs/:orgId — role requireRole se (req.membership), dobara DB se nahi
async function getOrg(req, res, next) {
  try {
    const org = await orgService.getOrg(req.membership.orgId);
    res.status(200).json({ org, role: req.membership.role });
  } catch (err) {
    next(err);
  }
}

// PATCH /orgs/:orgId — body { name }
async function updateOrg(req, res, next) {
  try {
    const org = await orgService.renameOrg(req.membership.orgId, req.body.name);
    res.status(200).json({ message: "Organization updated", org });
  } catch (err) {
    next(err);
  }
}

// DELETE /orgs/:orgId — org + memberships + invitations (transaction)
async function deleteOrg(req, res, next) {
  try {
    const { org, members, invitations } = await orgService.deleteOrg(req.membership.orgId);
    res.status(200).json({ message: "Organization deleted", org, deleted: { members, invitations } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrg, listOrgs, getOrg, updateOrg, deleteOrg };
