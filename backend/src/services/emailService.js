// email bhejne ka kaam yahan — abhi asal email nahi, sirf console par link
// baad mein asal email (nodemailer waghaira) lagani ho to sirf ye file badlegi
const config = require("../config");

function sendVerificationEmail(email, token) {
  // link mein asal (raw) token jaata hai — database mein sirf uska hash hai
  const link = `http://localhost:${config.port}/verify/${token}`;

  console.log(`Verification link for ${email}: ${link}`);
}

module.exports = {
  sendVerificationEmail
};
