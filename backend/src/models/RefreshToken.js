const mongoose = require("mongoose");

// har login/refresh par ek refresh token — DB mein sirf uska hash, asal token sirf cookie mein
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // logout-everywhere / chori pakadne par user ke saare tokens dhoondne hote hain
      index: true
    },
    // SHA-256 hex — DB leak ho jaye to bhi isse koi naya access token nahi le sakta
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true,
      // TTL index — expire hone ke baad MongoDB khud document hata deta hai (cleanup ki zaroorat nahi)
      expires: 0
    },
    // refresh (rotation) ya logout par lagta hai — revoke hua token dobara aaye to chori ka shak
    revokedAt: Date
  },
  // createdAt aur updatedAt khud ban jaate hain
  { timestamps: true }
);

// "RefreshToken" model — collection ka naam "refreshtokens" hoga
module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
