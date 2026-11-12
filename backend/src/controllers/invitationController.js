// invites ke controllers — sirf req/res; actor ka role requireRole se (req.membership), qaide invitationService mein
const invitationService = require("../services/invitationService");

// POST /orgs/:orgId/invitations — body { email, role }
async function sendInvitation(req, res, next) {
  try {
    const actor = { id: req.user.id, role: req.membership.role };
    const { invitation, replaced, devToken } = await invitationService.sendInvitation(req.membership.orgId, actor, {
      email: req.body.email,
      role: req.body.role
    });
    res.status(201).json({
      message: replaced ? "Invitation re-sent. The previous link no longer works." : "Invitation sent",
      invitation,
      ...(devToken ? { devToken } : {})
    });
  } catch (err) {
    next(err);
  }
}

// GET /orgs/:orgId/invitations
async function listInvitations(req, res, next) {
  try {
    const invitations = await invitationService.listInvitations(req.membership.orgId);
    res.status(200).json({ invitations });
  } catch (err) {
    next(err);
  }
}

// DELETE /orgs/:orgId/invitations/:inviteId
async function cancelInvitation(req, res, next) {
  try {
    const invitation = await invitationService.cancelInvitation(req.membership.orgId, req.params.inviteId);
    res.status(200).json({ message: "Invitation cancelled", invitation });
  } catch (err) {
    next(err);
  }
}

// GET /invitations/:token — token hi saboot hai (sirf API key; login ki zaroorat nahi)
async function getInvitation(req, res, next) {
  try {
    const invitation = await invitationService.getInvitation(req.params.token);
    res.status(200).json({ invitation });
  } catch (err) {
    next(err);
  }
}

// POST /invitations/:token/accept — login zaroori (authMiddleware)
async function acceptInvitation(req, res, next) {
  try {
    const { org, role } = await invitationService.acceptInvitation(req.params.token, req.user.id);
    res.status(200).json({ message: "Invitation accepted", org, role });
  } catch (err) {
    next(err);
  }
}

// GET /invitations — mujhe aaye pending invites
async function listReceived(req, res, next) {
  try {
    const invitations = await invitationService.listReceived(req.user.id);
    res.status(200).json({ invitations });
  } catch (err) {
    next(err);
  }
}

// POST /invitations/received/:inviteId/accept
async function acceptReceived(req, res, next) {
  try {
    const { org, role } = await invitationService.acceptReceived(req.params.inviteId, req.user.id);
    res.status(200).json({ message: "Invitation accepted", org, role });
  } catch (err) {
    next(err);
  }
}

// POST /invitations/received/:inviteId/decline
async function declineReceived(req, res, next) {
  try {
    const invitation = await invitationService.declineReceived(req.params.inviteId, req.user.id);
    res.status(200).json({ message: "Invitation declined", invitation });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendInvitation,
  listInvitations,
  cancelInvitation,
  getInvitation,
  acceptInvitation,
  listReceived,
  acceptReceived,
  declineReceived
};
