const mongoose = require("mongoose");

// task ka structure — MongoDB mein har task isi shape mein save hoga
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      // aage peeche ke spaces hata do — "   " khali string ban jaata hai aur required fail ho jaata hai
      trim: true
    },
    completed: {
      type: Boolean,
      // completed na bheja ho to false
      default: false
    },
    user: {
      // task kis user ka hai — yahan sirf User ka _id save hota hai
      type: mongoose.Schema.Types.ObjectId,
      // ref se Mongoose ko pata hai ke ye id "users" collection ke document ki hai (populate isi se chalta hai)
      ref: "User",
      // bina owner ke koi task nahi ban sakta
      required: true
    }
  },
  // createdAt aur updatedAt khud ban jaate hain
  { timestamps: true }
);

// "Task" model — collection ka naam "tasks" hoga
module.exports = mongoose.model("Task", taskSchema);
