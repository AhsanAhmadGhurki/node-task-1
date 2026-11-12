const mongoose = require("mongoose");
const { ROLES } = require("../utils/roles");

// user ↔ org ka rishta, aur us org mein uska role — role user ka nahi, membership ka hai
// (ek hi user Org A mein owner aur Org B mein viewer ho sakta hai)
const membershipSchema = new mongoose.Schema(
  {
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // "meri orgs" ki list — user se dhoondna
      index: true
    },
    role: {
      type: String,
      enum: ROLES,
      required: true
    }
  },
  { timestamps: true }
);

// ek user ek org mein sirf ek baar — do parallel invite-accept bhi do membership na bana sakein
// (org, user) order — requireRole har request par isi se { org, user } dhoondta hai
membershipSchema.index({ org: 1, user: 1 }, { unique: true });

// "is org mein kitne owners" — aakhri owner wala check har role badalne/nikalne par
membershipSchema.index({ org: 1, role: 1 });

module.exports = mongoose.model("Membership", membershipSchema);
