const mongoose = require("mongoose");

// ek attachment ki jaankari — sirf dikhane ke liye (naam, type, size)
// _id = File._id (models/File.js) — download GET /files/:fileId se; disk ka naam aur owner File mein, yahan nahi
const attachmentSchema = new mongoose.Schema({
  // user ka diya hua naam — sirf dikhane ke liye, disk ke path mein kabhi nahi
  // 255 — aam filesystem ki had; is se lamba naam DB/response bhar deta
  originalName: {
    type: String,
    required: true,
    maxlength: 255
  },
  // asli bytes se pakka kiya hua type (declared se match hone ke baad)
  mimetype: {
    type: String,
    required: true
  },
  // bytes mein
  size: {
    type: Number,
    required: true
  }
});

// support ticket — title, description aur 0–3 attachments
const ticketSchema = new mongoose.Schema(
  {
    // validators/ticketValidators.js bhi yahi had lagata hai (trim ke baad 5–100)
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    // ticket kis user ka hai — hamesha req.user.id se, body se kabhi nahi
    // index: list aur ownership wali har query { user } se hoti hai
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    }
  },
  {
    // createdAt aur updatedAt khud ban jaate hain
    timestamps: true,
    // response mein storedName nahi — naye tickets mein hota hi nahi (File mein hai), lekin migration se pehle ke
    // purane documents mein reh gaya ho to bhi bahar na jaye
    toJSON: {
      transform: (doc, ret) => {
        ret.attachments = (ret.attachments || []).map((attachment) => {
          const { storedName, ...safeAttachment } = attachment;
          return safeAttachment;
        });

        return ret;
      }
    }
  }
);

// "Ticket" model — collection ka naam "tickets" hoga
module.exports = mongoose.model("Ticket", ticketSchema);
