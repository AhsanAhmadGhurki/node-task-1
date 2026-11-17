const mongoose = require("mongoose");

// task ka structure — MongoDB mein har task isi shape mein save hoga
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      // aage peeche ke spaces hata do — "   " khali string ban jaata hai aur required fail ho jaata hai
      trim: true,
      // validation middleware bhi yahi had lagata hai — schema mein bhi, taake koi aur raasta (seed, script) bhi na tode
      maxlength: [200, "Title must be at most 200 characters"]
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
      // org ke task mein yeh "banane wala" hai — malik org hai, user nahi (member nikle to bhi task org mein rehta hai)
      required: true
    },
    // null = personal task (sirf user ka); id = workspace (org) ka task, us org ke members dekhte hain
    // purane tasks mein field hai hi nahi — { org: null } un ko bhi pakadta hai, migration ki zaroorat nahi
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null
    }
  },
  // createdAt aur updatedAt khud ban jaate hain
  { timestamps: true }
);

// personal list — { user, org: null }; pehle user par koi index tha hi nahi (har GET /tasks poori collection padhta)
taskSchema.index({ user: 1, org: 1, createdAt: 1 });
// org ki list (purane pehle) aur org delete par us ke saare tasks
taskSchema.index({ org: 1, createdAt: 1 });

// "Task" model — collection ka naam "tasks" hoga
module.exports = mongoose.model("Task", taskSchema);
