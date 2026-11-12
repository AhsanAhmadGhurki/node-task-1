const mongoose = require("mongoose");
const { INVITABLE_ROLES } = require("../utils/roles");

// org ka invite — link ka asal token sirf email mein; DB mein uska SHA-256 (RefreshToken jaisa), DB leak ho to bhi link nahi banta
// halat (state):
//   pending  — bheja gaya, abhi accept nahi hua (expiresAt guzar jaye to "expired" — ye field se nahi, waqt se nikalta hai)
//   accepted — accept ho gaya (acceptedAt, acceptedBy) — dobara kabhi nahi
//   replaced — usi email ko dobara invite kiya gaya; naye document ka naya token, is ka token band
// cancel = document hi mit jaata hai
const STATUSES = ["pending", "accepted", "replaced"];

// 48 ghante — link isse zyada nahi chalta
const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

const invitationSchema = new mongoose.Schema(
  {
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    // trim + lowercase — "QA@X.com " aur "qa@x.com" ek hi invite (User.email jaisa)
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    // owner kabhi invite se nahi (README) — enum hi rok deta hai
    role: {
      type: String,
      enum: INVITABLE_ROLES,
      required: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    replacedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        // hash kabhi response mein nahi
        delete ret.tokenHash;
        return ret;
      }
    }
  }
);

// ek org mein ek email ka sirf EK pending invite — partial: accepted/replaced purane documents ginti mein nahi
// (warna member org chhod kar dobara invite hi na ho sakta). do admin ek saath invite karein to ek ko 11000
invitationSchema.index({ org: 1, email: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

// org ki list (pending pehle) — GET /orgs/:orgId/invitations
invitationSchema.index({ org: 1, status: 1, createdAt: -1 });

// expire hue PENDING invites 7 din baad khud mit jayein (accepted/replaced hisaab ke liye rehte hain)
// 7 din ka waqfa — tab tak link kholne wale ko "expired" (410) dikhe, "nahi mila" nahi
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: "pending" } });

const Invitation = mongoose.model("Invitation", invitationSchema);
Invitation.STATUSES = STATUSES;
Invitation.INVITATION_TTL_MS = INVITATION_TTL_MS;

module.exports = Invitation;
