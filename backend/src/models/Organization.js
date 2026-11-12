const mongoose = require("mongoose");

// ek workspace — kaun member hai aur kis role mein, ye yahan NAHI, Membership mein (ek hi jagah sach)
// warna owner do jagah likha hota aur ek jagah badalne par dono alag ho jaate
const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    // sirf hisaab ke liye (kis ne banaya) — ijazat ke liye kabhi nahi; owner badal sakta hai, ye nahi
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
