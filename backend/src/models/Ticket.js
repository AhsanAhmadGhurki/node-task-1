const mongoose = require("mongoose");

// ek attachment ki jaankari — file khud disk par (uploads/tickets), DB mein sirf uska hisaab
// har attachment ka apna _id banta hai — download route (/tickets/:id/attachments/:attachmentId) isi se file dhoondta hai
const attachmentSchema = new mongoose.Schema({
  // disk par server ka diya hua naam (<userId>-<uuid><ext>) — andar ki baat, response mein kabhi nahi (toJSON neeche)
  storedName: {
    type: String,
    required: true
  },
  // user ka diya hua naam — sirf dikhane aur download ke naam ke liye, disk ke path mein kabhi nahi
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
    // response mein storedName nahi — client ko disk ka naam pata hone ki zaroorat nahi, download _id se hota hai
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
