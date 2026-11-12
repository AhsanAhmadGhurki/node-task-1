// org invites — bhejna, link ki jaanch, accept, list, cancel
// token: 32 random bytes (base64url) sirf email ke link mein; DB mein SHA-256 — DB leak ho to bhi koi link nahi bana sakta
// har org wali query { org: orgId } ke saath — Org A ka admin Org B ka invite na dekh sake na mita sake
const crypto = require("crypto");
const mongoose = require("mongoose");
const config = require("../config");
const Invitation = require("../models/Invitation");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const User = require("../models/User");
const emailService = require("./emailService");
const ConflictError = require("../utils/ConflictError");
const ForbiddenError = require("../utils/ForbiddenError");
const GoneError = require("../utils/GoneError");
const NotFoundError = require("../utils/NotFoundError");
const { canAssignRole } = require("../utils/roles");

const INVITATION_NOT_FOUND = "Invitation not found";
const ALREADY_MEMBER = "You are already a member of this organization";

// 32 bytes → base64url 43 characters; is shakal ke bina DB tak jaane ki zaroorat hi nahi
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// POST /orgs/:orgId/invitations — actor = { id, role } (requireRole("admin") se)
// pehle se member → 409; usi email ka pending invite → "replaced" (purana token band), naya invite + naya token
async function sendInvitation(orgId, actor, { email, role }) {
  // admin sirf member/viewer ko bula sakta hai; admin role ka invite sirf owner
  if (!canAssignRole(actor.role, role)) {
    throw new ForbiddenError(`Your role (${actor.role}) can't invite someone as ${role}`);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  let org;
  let invitation;
  let replaced;

  try {
    // transaction — purane ko "replaced" karna aur naya banana dono, ya koi nahi (warna email ka koi chalta invite na bachta)
    await mongoose.connection.transaction(async (session) => {
      org = await Organization.findById(orgId).session(session);
      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      const user = await User.findOne({ email }).select("_id").session(session);
      if (user && (await OrganizationMember.exists({ org: orgId, user: user._id }).session(session))) {
        throw new ConflictError("This email already belongs to a member of this organization");
      }

      const now = new Date();
      const result = await Invitation.updateMany(
        { org: orgId, email, status: "pending" },
        { $set: { status: "replaced", replacedAt: now } },
        { session }
      );
      replaced = result.modifiedCount > 0;

      [invitation] = await Invitation.create(
        // createdAt khud diya — expiresAt theek 48 ghante baad ho (timestamps ka apna waqt 1–2 ms aage hota)
        [{ org: orgId, email, role, tokenHash: hashToken(token), invitedBy: actor.id, createdAt: now, expiresAt: new Date(now.getTime() + Invitation.INVITATION_TTL_MS) }],
        { session }
      );
    });
  } catch (err) {
    // do admin ne isi email ko ek saath invite kiya — pending wala unique index ek ko rokta hai
    if (err.code === 11000) {
      throw new ConflictError("Another invitation for this email was sent at the same time. Please try again.");
    }
    throw err;
  }

  // commit ke BAAD email — rollback hua invite ka link kabhi na jaye; await nahi (SMTP 1–4 second)
  const inviter = await User.findById(actor.id).select("name email").lean();
  emailService.sendInviteEmail(email, {
    orgName: org.name,
    role,
    inviterName: inviter?.name || inviter?.email || "A teammate",
    url: `${config.frontendUrl}/invitations/${token}`,
    expiresInHours: Invitation.INVITATION_TTL_MS / (60 * 60 * 1000)
  });

  // EXPOSE_DEV_OTP (sirf non-production) — Postman/Newman runner email nahi parh sakta, devOtp jaisa
  return { invitation, replaced, ...(config.exposeDevOtp ? { devToken: token } : {}) };
}

// token se invite — shakal ghalat ho to DB tak bhi nahi
async function findByToken(token, session = null) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    return null;
  }
  return Invitation.findOne({ tokenHash: hashToken(token) }).session(session);
}

// invite abhi chal sakta hai? — har na-chalne wali halat ka apna jawab (link token ke malik ko hi dikhta hai)
function assertUsable(invitation) {
  if (!invitation) {
    throw new NotFoundError(INVITATION_NOT_FOUND);
  }
  if (invitation.status === "accepted") {
    throw new ConflictError("This invitation has already been accepted");
  }
  if (invitation.status === "replaced") {
    throw new GoneError("This invitation link is no longer valid because a newer invitation was sent");
  }
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new GoneError("This invitation has expired. Ask an admin to send a new one.");
  }
}

// GET /invitations/:token — frontend ka invite page (login se pehle bhi): kis org mein, kis role mein, kab tak
// tokenHash, ids, invitedBy ka email waghaira nahi — sirf dikhane layak
async function getInvitation(token) {
  const invitation = await findByToken(token);
  assertUsable(invitation);
  const [org, inviter] = await Promise.all([
    Organization.findById(invitation.org).select("name").lean(),
    User.findById(invitation.invitedBy).select("name").lean()
  ]);
  if (!org) {
    throw new NotFoundError(INVITATION_NOT_FOUND);
  }
  return {
    org: { name: org.name },
    email: invitation.email,
    role: invitation.role,
    invitedBy: inviter?.name || null,
    expiresAt: invitation.expiresAt
  };
}

// accept ka asal kaam — link (token) se ho ya "received" list (id) se; find(session, user) invite dhoondta hai
// ek transaction: jaanch + membership + invite "accepted" — do parallel accept mein sirf ek kamyab
async function acceptWith(userId, find) {
  let accepted;
  try {
    await mongoose.connection.transaction(async (session) => {
      const user = await User.findById(userId).select("email").session(session);
      const invitation = await find(session, user);
      assertUsable(invitation);

      if (!user || user.email !== invitation.email) {
        throw new ForbiddenError("This invitation was sent to a different email address. Log in with that email to accept it.");
      }

      if (await OrganizationMember.exists({ org: invitation.org, user: userId }).session(session)) {
        throw new ConflictError(ALREADY_MEMBER);
      }

      await OrganizationMember.create([{ org: invitation.org, user: userId, role: invitation.role }], { session });
      // policy mein owner invite nahi hota (enum) — phir bhi kabhi khula to ownerCount saath rahe
      if (invitation.role === "owner") {
        await Organization.updateOne({ _id: invitation.org }, { $inc: { ownerCount: 1 } }, { session });
      }

      // sirf pending se accepted — beech mein doosri request accept kar chuki ho to 0 → 409
      const result = await Invitation.updateOne(
        { _id: invitation._id, status: "pending" },
        { $set: { status: "accepted", acceptedAt: new Date(), acceptedBy: userId } },
        { session }
      );
      if (result.modifiedCount !== 1) {
        throw new ConflictError("This invitation has already been accepted");
      }
      accepted = { orgId: invitation.org, role: invitation.role };
    });
  } catch (err) {
    // membership ka unique index — parallel accept ne pehle bana di
    if (err.code === 11000) {
      throw new ConflictError(ALREADY_MEMBER);
    }
    throw err;
  }

  const org = await Organization.findById(accepted.orgId).lean();
  return { org, role: accepted.role };
}

// POST /invitations/:token/accept — email ka link; logged-in user ka email invite wala hi ho (warna 403)
function acceptInvitation(token, userId) {
  return acceptWith(userId, (session) => findByToken(token, session));
}

// "received" — sirf MERE email ke invites; id se dhoondte waqt email bhi shart mein, is liye kisi aur ka invite id → 404
// (token yahan nahi chahiye: logged-in user ka verified email hi saboot hai ke invite usi ka hai)
function findMine(inviteId, user, session = null) {
  if (!user || typeof inviteId !== "string" || !OBJECT_ID.test(inviteId)) {
    return null;
  }
  return Invitation.findOne({ _id: inviteId, email: user.email }).session(session);
}

// GET /invitations — mujhe aaye pending invites (har org ke), expire hue nahi; tokenHash nahi
async function listReceived(userId) {
  const user = await User.findById(userId).select("email").lean();
  if (!user) {
    return [];
  }
  const invitations = await Invitation.find({ email: user.email, status: "pending", expiresAt: { $gt: new Date() } })
    .select("-tokenHash")
    .sort({ createdAt: -1 })
    .populate("org", "name")
    .populate("invitedBy", "name email")
    .lean();
  // org beech mein delete ho gayi ho to (transaction us ke invites bhi mitata hai) — phir bhi bacha ho to chhod do
  return invitations.filter((inv) => inv.org);
}

// POST /invitations/received/:inviteId/accept
function acceptReceived(inviteId, userId) {
  return acceptWith(userId, (session, user) => findMine(inviteId, user, session));
}

// POST /invitations/received/:inviteId/decline — sirf mera pending invite; document mit jaata hai (cancel jaisa)
async function declineReceived(inviteId, userId) {
  const user = await User.findById(userId).select("email").lean();
  if (!user || typeof inviteId !== "string" || !OBJECT_ID.test(inviteId)) {
    throw new NotFoundError(INVITATION_NOT_FOUND);
  }
  const invitation = await Invitation.findOneAndDelete({ _id: inviteId, email: user.email, status: "pending" }).select("-tokenHash").lean();
  if (!invitation) {
    throw new NotFoundError(INVITATION_NOT_FOUND);
  }
  return invitation;
}

// GET /orgs/:orgId/invitations — sirf pending (expire hue bhi, "expired: true" ke saath, taake admin dobara bheje)
async function listInvitations(orgId) {
  // lean() toJSON nahi chalata — tokenHash yahin select se bahar
  const invitations = await Invitation.find({ org: orgId, status: "pending" })
    .select("-tokenHash")
    .sort({ createdAt: -1 })
    .populate("invitedBy", "name email")
    .lean();
  const now = Date.now();
  return invitations.map((inv) => ({ ...inv, expired: inv.expiresAt.getTime() <= now }));
}

// DELETE /orgs/:orgId/invitations/:inviteId — sirf isi org ka pending invite; doosri org ka id bhi 404
async function cancelInvitation(orgId, inviteId) {
  if (typeof inviteId !== "string" || !OBJECT_ID.test(inviteId)) {
    throw new NotFoundError(INVITATION_NOT_FOUND);
  }
  const invitation = await Invitation.findOneAndDelete({ _id: inviteId, org: orgId, status: "pending" }).select("-tokenHash").lean();
  if (!invitation) {
    throw new NotFoundError(INVITATION_NOT_FOUND);
  }
  return invitation;
}

module.exports = {
  INVITATION_NOT_FOUND,
  hashToken,
  sendInvitation,
  getInvitation,
  acceptInvitation,
  listInvitations,
  cancelInvitation,
  listReceived,
  acceptReceived,
  declineReceived
};
