const mongoose = require("mongoose");

// user ka structure — MongoDB mein har user isi shape mein save hoga
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      // ek email se ek hi user — MongoDB mein unique index banta hai
      unique: true,
      trim: true,
      // "Ali@X.com" aur "ali@x.com" ek hi user hain
      lowercase: true
    },
    password: {
      type: String,
      // yahan asal password nahi, bcrypt ka hash save hota hai
      required: true
    },
    isVerified: {
      type: Boolean,
      // naya user email ka code daalne tak unverified rehta hai (code models/Otp.js mein)
      default: false
    },
    // lagataar galat password — 5 par account 15 minute band (authService.checkCredentials)
    // DB mein — server restart se lock nahi tootta; sahi password par 0
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    // is waqt tak login band — null ya guzra hua waqt = band nahi
    lockUntil: {
      type: Date,
      default: null
    }
  },
  {
    // createdAt aur updatedAt khud ban jaate hain
    timestamps: true,
    toJSON: {
      // res.json(user) mein password ka hash kabhi bahar na jaye
      // purane users mein link wale fields (verificationToken…) reh gaye hon to woh bhi nahi
      transform(doc, ret) {
        delete ret.password;
        // lockout ki andar ki halat — client ko nahi chahiye (login ka jawab hi batata hai)
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        delete ret.verificationTokenHash;
        delete ret.verificationTokenExpires;
        delete ret.verificationEmailSentAt;
        return ret;
      }
    }
  }
);

// "User" model — collection ka naam "users" hoga
module.exports = mongoose.model("User", userSchema);
