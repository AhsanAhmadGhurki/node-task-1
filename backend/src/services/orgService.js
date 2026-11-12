// organizations aur memberships — saara DB kaam yahan (controller aur requireRole sirf isi ko bulate hain)
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Invitation = require("../models/Invitation");
const User = require("../models/User");
const ForbiddenError = require("../utils/ForbiddenError");
const NotFoundError = require("../utils/NotFoundError");

// non-member ko bhi yahi — "hai lekin aap ki nahi" aur "hai hi nahi" ek jaisa (existence leak nahi)
const ORG_NOT_FOUND = "Organization not found";

// sirf 24 hex — ghalat shakal par CastError ka 400 "Invalid org" bata deta ke route sahi hai; 404 sab ke liye ek
const OBJECT_ID = /^[0-9a-f]{24}$/i;

// POST /orgs — banane wala khud pehla owner
async function createOrg({ userId, name }) {
  // token sirf verified user ko milta hai (login 403, verify-email ke baad hi token) — phir bhi task ki shart yahan saaf
  const user = await User.findById(userId).select("isVerified");
  if (!user || !user.isVerified) {
    throw new ForbiddenError("Only verified users can create an organization");
  }

  // transaction — org aur us ka owner dono bane, ya koi nahi (bina owner ki org kabhi na bache)
  // connection.transaction() write conflict par khud dobara koshish karta hai
  let org;
  await mongoose.connection.transaction(async (session) => {
    [org] = await Organization.create([{ name, createdBy: userId, ownerCount: 1 }], { session });
    await OrganizationMember.create([{ org: org._id, user: userId, role: "owner" }], { session });
  });

  return { org, role: "owner" };
}

// GET /orgs — sirf woh orgs jin ka user member hai, har ek ke saath us ka role
async function listMyOrgs(userId) {
  const memberships = await OrganizationMember.find({ user: userId }).sort({ createdAt: 1 }).populate("org").lean();
  // org mit chuki ho (beech mein delete) to membership akeli — chhod do
  return memberships.filter((m) => m.org).map((m) => ({ ...m.org, role: m.role }));
}

// requireRole har org route par — user is org ka member hai? (null = nahi, ya id ghalat shakal ki)
async function findMembership(orgId, userId) {
  if (typeof orgId !== "string" || !OBJECT_ID.test(orgId)) {
    return null;
  }
  return OrganizationMember.findOne({ org: orgId, user: userId }).select("org role").lean();
}

// GET /orgs/:orgId — requireRole membership pehle hi dekh chuka; yahan sirf org khud
async function getOrg(orgId) {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new NotFoundError(ORG_NOT_FOUND);
  }
  return org;
}

// PATCH /orgs/:orgId — sirf naam; role ka check (admin+) route par requireRole kar chuka
async function renameOrg(orgId, name) {
  const org = await Organization.findByIdAndUpdate(
    orgId,
    { $set: { name } },
    { returnDocument: "after", runValidators: true }
  );
  // requireRole ke baad bhi beech mein kisi ne delete kar di ho
  if (!org) {
    throw new NotFoundError(ORG_NOT_FOUND);
  }
  return org;
}

// DELETE /orgs/:orgId — org, us ki saari memberships aur invitations ek transaction mein (sirf owner, requireRole)
// beech mein koi bhi qadam fail ho to sab wapas — aadhi mitti org (members bina org ke) kabhi nahi bachti
// har query { org: orgId } se — doosri org ka koi document is ki zad mein nahi aata
// (tasks/tickets org mein aayenge to unhein bhi isi transaction mein jodna hai)
async function deleteOrg(orgId) {
  let deleted;
  await mongoose.connection.transaction(async (session) => {
    const org = await Organization.findByIdAndDelete(orgId, { session });
    // requireRole ke baad kisi aur request ne pehle hi mita di — 404, aur transaction mein kuch nahi badla
    if (!org) {
      throw new NotFoundError(ORG_NOT_FOUND);
    }
    const members = await OrganizationMember.deleteMany({ org: orgId }, { session });
    const invitations = await Invitation.deleteMany({ org: orgId }, { session });
    deleted = { org, members: members.deletedCount, invitations: invitations.deletedCount };
  });
  return deleted;
}

module.exports = { ORG_NOT_FOUND, createOrg, listMyOrgs, findMembership, getOrg, renameOrg, deleteOrg };
