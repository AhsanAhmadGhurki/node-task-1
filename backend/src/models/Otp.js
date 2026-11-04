const mongoose = require("mongoose");

// email par jaane wale 6-digit codes — register ke baad email verify, aur login ka doosra qadam (2FA)
// har user + purpose ka sirf EK document: abhi wala code + ghante bhar ki request ginti
const otpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // "verify-email" (register ke baad) ya "login" (2FA) — har purpose ka document aur ghante ki ginti alag
    // (login ke codes verify ki 3/ghanta had na khayein, aur ulta bhi)
    purpose: {
      type: String,
      enum: ["verify-email", "login"],
      required: true
    },
    // bcrypt hash — asal code sirf email mein, DB leak ho to bhi code nahi milta
    // code use ho jaye ya 5 galat koshishen ho jayein to $unset — "code hai hi nahi"
    otpHash: String,
    // code ki umar — 5 minute
    expiresAt: Date,
    // is code par galat koshishen — 5 par code band
    attempts: {
      type: Number,
      default: 0
    },
    // ghante mein 3 codes — window kab shuru hui aur ab tak kitne maange
    windowStart: {
      type: Date,
      required: true
    },
    requestCount: {
      type: Number,
      default: 0
    },
    // TTL — har request par ghante bhar aage; purana document MongoDB khud hata deta hai
    purgeAt: {
      type: Date,
      required: true,
      expires: 0
    }
  },
  { timestamps: true }
);

// ek user, ek purpose, ek document — naya code purane ko overwrite karta hai (purana foran band)
otpSchema.index({ user: 1, purpose: 1 }, { unique: true });

// "Otp" model — collection ka naam "otps" hoga
module.exports = mongoose.model("Otp", otpSchema);
