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
    }
  },
  {
    // createdAt aur updatedAt khud ban jaate hain
    timestamps: true,
    toJSON: {
      // res.json(user) mein hash kabhi bahar na jaye
      transform(doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

// "User" model — collection ka naam "users" hoga
module.exports = mongoose.model("User", userSchema);
