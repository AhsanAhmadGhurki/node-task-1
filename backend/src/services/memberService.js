// org ke members — list, details, role badalna, nikalna, khud chhodna
// har query { org: orgId } ke saath — Org A ki request Org B ke member tak kabhi nahi pahunchti
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const BadRequestError = require("../utils/BadRequestError");
const ConflictError = require("../utils/ConflictError");
const ForbiddenError = require("../utils/ForbiddenError");
const NotFoundError = require("../utils/NotFoundError");
const authService = require("./authService");
const { ROLE_RANK, canAssignRole, canManageMember } = require("../utils/roles");

const MEMBER_NOT_FOUND = "Member not found";

// aakhri owner — har raste ka apna saaf paigham (400)
const LAST_OWNER = {
  demote: "An organization must always have at least one owner. Make another member an owner before changing this role.",
  remove: "An organization must always have at least one owner. Make another member an owner before removing this one.",
  leave: "You are the last owner. Make another member an owner before leaving the organization."
};

// user id ki shakal — ghalat ho to bhi 404 (CastError ka 400 nahi)
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// user ki sirf zaroori, ghair-hassas fields — password/lock waghaira kabhi nahi
const USER_FIELDS = "email name avatar";

// jawab ki ek hi shakal — list aur details dono mein
function toMember(doc) {
  return { user: doc.user, role: doc.role, joinedAt: doc.createdAt };
}

// GET /orgs/:orgId/members — owners pehle, phir admin, member, viewer; har role mein purane pehle
async function listMembers(orgId) {
  const docs = await OrganizationMember.find({ org: orgId }).sort({ createdAt: 1 }).populate("user", USER_FIELDS).lean();
  return docs
    // user account mit chuka ho to membership akeli — chhod do
    .filter((doc) => doc.user)
    .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role])
    .map(toMember);
}

// GET /orgs/:orgId/members/:userId — sirf isi org ka member; doosri org ka user bhi 404
async function getMember(orgId, userId) {
  if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
    throw new NotFoundError(MEMBER_NOT_FOUND);
  }
  const doc = await OrganizationMember.findOne({ org: orgId, user: userId }).populate("user", USER_FIELDS).lean();
  if (!doc || !doc.user) {
    throw new NotFoundError(MEMBER_NOT_FOUND);
  }
  return toMember(doc);
}

// owner kam karne se PEHLE — sirf tab jab abhi ek se zyada owners hon; warna 400 (transaction ke andar)
// do owners ek saath ek doosre ko hatayein: dono isi org document ko likhte hain → write conflict → ek transaction
// dobara chalta hai, tab tak ownerCount 1 ho chuka → 400. org kabhi bina owner nahi
async function releaseOwnerSeat(orgId, session, message) {
  const org = await Organization.findOneAndUpdate(
    { _id: orgId, ownerCount: { $gt: 1 } },
    { $inc: { ownerCount: -1 } },
    { session, returnDocument: "after" }
  );
  if (!org) {
    throw new BadRequestError(message);
  }
}

// target member — sirf isi org mein (doosri org ka user / ghalat id → 404)
async function findTarget(orgId, userId, session) {
  if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
    throw new NotFoundError(MEMBER_NOT_FOUND);
  }
  const target = await OrganizationMember.findOne({ org: orgId, user: userId }).session(session);
  if (!target) {
    throw new NotFoundError(MEMBER_NOT_FOUND);
  }
  return target;
}

// role badalte/nikalte waqt target bhi beech mein badal gaya ho (doosri request) — role ki shart ke saath likhte hain
// (transaction ka write conflict aam taur par pehle hi rok deta; ye aakhri pehra hai)
function changedMeanwhile() {
  return new ConflictError("This member was changed by another request. Please try again.");
}

// PATCH /orgs/:orgId/members/:userId/role — actor = { id, role } (requireRole se); qaide utils/roles mein
async function changeRole(orgId, actor, userId, newRole) {
  await mongoose.connection.transaction(async (session) => {
    const target = await findTarget(orgId, userId, session);

    // admin owner/admin ko nahi chhed sakta; owner sab ko (khud ko bhi — aakhri owner ka qaida neeche)
    if (!canManageMember(actor.role, target.role)) {
      throw new ForbiddenError(`Your role (${actor.role}) can't change the role of an ${target.role}`);
    }
    // sirf owner kisi ko admin/owner bana sakta hai
    if (!canAssignRole(actor.role, newRole)) {
      throw new ForbiddenError(`Your role (${actor.role}) can't make someone ${newRole}`);
    }
    if (target.role === newRole) {
      return;
    }

    if (target.role === "owner") {
      await releaseOwnerSeat(orgId, session, LAST_OWNER.demote);
    }
    if (newRole === "owner") {
      await Organization.updateOne({ _id: orgId }, { $inc: { ownerCount: 1 } }, { session });
    }

    const updated = await OrganizationMember.updateOne(
      { _id: target._id, role: target.role },
      { $set: { role: newRole } },
      { session, runValidators: true }
    );
    if (updated.modifiedCount !== 1) {
      throw changedMeanwhile();
    }
  });

  return getMember(orgId, userId);
}

// DELETE /orgs/:orgId/members/:userId — doosre ko nikaalna; khud ke liye /leave
async function removeMember(orgId, actor, userId) {
  if (userId === actor.id) {
    throw new BadRequestError("You can't remove yourself. Use POST /orgs/:orgId/leave to leave the organization.");
  }

  let removed;
  await mongoose.connection.transaction(async (session) => {
    const target = await findTarget(orgId, userId, session);

    if (!canManageMember(actor.role, target.role)) {
      throw new ForbiddenError(`Your role (${actor.role}) can't remove an ${target.role}`);
    }
    if (target.role === "owner") {
      await releaseOwnerSeat(orgId, session, LAST_OWNER.remove);
    }

    const result = await OrganizationMember.deleteOne({ _id: target._id, role: target.role }, { session });
    if (result.deletedCount !== 1) {
      throw changedMeanwhile();
    }
    removed = { user: target.user, role: target.role };
  });

  return removed;
}

// POST /orgs/:orgId/leave — khud chhodna; har role kar sakta hai, sirf aakhri owner nahi (400)
async function leaveOrg(orgId, actor) {
  await mongoose.connection.transaction(async (session) => {
    const own = await findTarget(orgId, actor.id, session);
    if (own.role === "owner") {
      await releaseOwnerSeat(orgId, session, LAST_OWNER.leave);
    }
    const result = await OrganizationMember.deleteOne({ _id: own._id, role: own.role }, { session });
    if (result.deletedCount !== 1) {
      throw changedMeanwhile();
    }
  });
}

// POST /orgs/:orgId/transfer-ownership — sirf owner (requireRole); password dobara; naya owner isi org ka member
// ek transaction: naya → owner, purana → admin, ownerCount +1 phir -1 (wahi rehta hai)
// org document dono baar likha jaata hai — saath chal rahe role/leave/transfer write conflict se ek ek karke chalte hain
async function transferOwnership(orgId, actor, newOwnerId, password) {
  if (newOwnerId === actor.id) {
    throw new BadRequestError("You are already an owner. Choose another member.");
  }

  // transaction se PEHLE — bcrypt ~250ms; ghalat password par DB mein kuch shuru hi na ho
  await authService.confirmPassword(actor.id, password);

  await mongoose.connection.transaction(async (session) => {
    const target = await findTarget(orgId, newOwnerId, session);
    if (target.role === "owner") {
      throw new BadRequestError("This member is already an owner");
    }

    await Organization.updateOne({ _id: orgId }, { $inc: { ownerCount: 1 } }, { session });
    const promoted = await OrganizationMember.updateOne(
      { _id: target._id, role: target.role },
      { $set: { role: "owner" } },
      { session }
    );
    const demoted = await OrganizationMember.updateOne(
      { org: orgId, user: actor.id, role: "owner" },
      { $set: { role: "admin" } },
      { session }
    );
    // beech mein kisi ne target ya actor ka role badal diya (jaise do transfer ek saath) — kuch nahi badla
    if (promoted.modifiedCount !== 1 || demoted.modifiedCount !== 1) {
      throw changedMeanwhile();
    }
    await releaseOwnerSeat(orgId, session, LAST_OWNER.demote);
  });

  const [newOwner, previousOwner] = await Promise.all([getMember(orgId, newOwnerId), getMember(orgId, actor.id)]);
  return { newOwner, previousOwner };
}

module.exports = { MEMBER_NOT_FOUND, LAST_OWNER, OBJECT_ID, listMembers, getMember, changeRole, removeMember, leaveOrg, transferOwnership };
