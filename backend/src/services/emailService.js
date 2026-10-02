// email bhejne ka kaam yahan — SMTP (Gmail) se asal email, saath mein console par link bhi
const nodemailer = require("nodemailer");
const config = require("../config");

// SMTP user/pass .env mein hon tabhi transporter banao — warna sirf console wala link
const transporter =
  config.smtp.user && config.smtp.pass
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        // 465 par shuru se TLS, 587 par baad mein (STARTTLS)
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
        // Gmail na mile to default 2 minute tak latka rehta — 10 second mein haar maan lo
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      })
    : null;

// email clients (Gmail, Outlook) sirf inline styles aur tables theek dikhate hain — isliye yahi pattern
function verificationEmailHtml(link) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb">
      <tr><td style="padding:32px 28px;text-align:center">
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827">Verify your email</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563">Thanks for signing up! Click the button below to verify your email address.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px">Verify email</a>
        <p style="margin:24px 0 0;font-size:13px;color:#9ca3af">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

async function sendVerificationEmail(email, token) {
  // link mein asal (raw) token jaata hai — database mein sirf uska hash hai
  // base URL .env (APP_URL) se — production mein code nahi, sirf .env badlega
  const link = `${config.appUrl}/verify/${token}`;

  // SMTP nahi — development mein verify karne ka yahi ek rasta, isliye sirf tab link console par
  // SMTP ho to raw token kabhi log nahi hota — logs parhne wala link chura kar verify na kar sake
  if (!transporter) {
    console.log(`[dev — SMTP not configured] Verification link for ${email}: ${link}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Tasks API" <${config.smtp.user}>`,
      to: email,
      subject: "Verify your email",
      // jo email client HTML na dikhaye uske liye simple text
      text: `Verify your email by opening this link (valid for 24 hours):\n\n${link}`,
      html: verificationEmailHtml(link)
    });
    console.log(`Verification email sent to ${email}`);
  } catch (err) {
    // email fail ho to register/resend fail nahi karte — user save ho chuka, resend se dobara bhej sakte hain
    console.error(`Verification email to ${email} failed:`, err.message);
  }
}

module.exports = {
  sendVerificationEmail
};
