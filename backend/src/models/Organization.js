const mongoose = require("mongoose");

// ek workspace — kaun member hai aur kis role mein, ye yahan NAHI, OrganizationMember mein (ek hi jagah sach)
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
    },
    // kitne owners — "aakhri owner" ka pehra. owner hatane/demote karne wala har kaam ek transaction mein pehle
    // { ownerCount: { $gt: 1 } } par $inc -1 karta hai; do owners ek saath ek doosre ko hatayein to dono transactions
    // isi ek document ko likhte hain — MongoDB write conflict se ek ko rok deta hai, org kabhi 0 owners par nahi aati
    // (OrganizationMember ke owners se mel orgService rakhta hai — owner banane/hatane ka har rasta isi ko badalta hai)
    ownerCount: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
