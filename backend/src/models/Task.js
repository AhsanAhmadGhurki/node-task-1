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
    }
  },
  // createdAt aur updatedAt khud ban jaate hain
  { timestamps: true }
);

// "Task" model — collection ka naam "tasks" hoga
module.exports = mongoose.model("Task", taskSchema);
