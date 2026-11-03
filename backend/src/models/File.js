const mongoose = require("mongoose");

// har upload hui file ka ek record — GET /files/:fileId isi ke _id se file dhoondta hai
// file khud disk par (uploads/avatars ya uploads/tickets), DB mein sirf uska hisaab aur MALIK
// ek hi jagah owner rakhne ka faida: avatar ho ya ticket attachment, ownership check ek hi query
const fileSchema = new mongoose.Schema(
  {
    // file kis user ki hai — hamesha req.user.id se, body se kabhi nahi
    // index: ownership check aur user ki files ki safai isi se
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    // kis kaam ki file — isi se disk ka folder chuna jaata hai (fileService.FILE_DIRS)
    kind: {
      type: String,
      enum: ["avatar", "ticket-attachment"],
      required: true
    },
    // attachment ho to kis ticket ki — avatar ke liye null
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
      index: true
    },
    // disk par server ka diya hua naam (<userId>-<...><ext>) — andar ki baat, response mein kabhi nahi (toJSON neeche)
    // unique: do records ek hi disk file par point na karein (ek mite to doosra toot jaata)
    storedName: {
      type: String,
      required: true,
      unique: true
    },
    // user ka diya hua naam — sirf dikhane aur download ke naam ke liye, disk ke path mein kabhi nahi
    originalName: {
      type: String,
      required: true,
      maxlength: 255
    },
    // upload ke waqt asli bytes (magic bytes) se pakka kiya hua — serve karte waqt Content-Type yahi
    mimetype: {
      type: String,
      required: true
    },
    // bytes mein
    size: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.storedName;
        return ret;
      }
    }
  }
);

// "File" model — collection ka naam "files" hoga
module.exports = mongoose.model("File", fileSchema);
