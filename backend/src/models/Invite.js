const mongoose = require("mongoose");
const { INVITABLE_ROLES } = require("../utils/roles");

// pending invite — accept hote hi mit jaata hai (Membership ban jaati hai)
// link ka token sirf email mein; DB mein uska SHA-256 (RefreshToken jaisa) — DB leak ho to bhi link nahi banta
const inviteSchema = new mongoose.Schema(
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
    // owner kabhi invite se nahi — enum hi rok deta hai
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
    // 48 ghante — TTL index expire hone ke baad MongoDB khud mita deta hai
    // (TTL ka safaya ~60 second baad chalta hai — is liye accept ke waqt expiresAt khud bhi check hoga)
    expiresAt: {
      type: Date,
      required: true,
      expires: 0
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        // hash bhi kabhi response mein nahi
        delete ret.tokenHash;
        return ret;
      }
    }
  }
);

// ek org mein ek email ka sirf ek pending invite — dobara invite isi document ka token badalta hai,
// is liye purana link khud band (naya hash, purana kahin nahi bacha)
inviteSchema.index({ org: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Invite", inviteSchema);
