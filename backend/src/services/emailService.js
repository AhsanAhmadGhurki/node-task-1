// email bhejne ka kaam yahan — SMTP (Gmail) se 6-digit codes; SMTP na ho to code sirf console par
const nodemailer = require("nodemailer");
const config = require("../config");

// SMTP user/pass .env mein hon tabhi transporter banao — warna sirf console wala code
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

// har purpose ka subject aur paigham — design ek hi
const OTP_EMAILS = {
  "verify-email": {
    subject: "Verify your email",
    heading: "Verify your email",
    intro: "Thanks for signing up! Enter this code to verify your email address.",
    // waqt config se — "5 minutes" hardcode hota to OTP_TTL_MS badalne par email jhoot bolti
    footer: (minutes) =>
      `This code expires in ${minutes} minute${minutes === 1 ? "" : "s"}. If you didn't create an account, you can ignore this email.`,
    logLabel: "Verification code"
  },
  login: {
    subject: "Your login code",
    heading: "Your login code",
    intro: "Someone (hopefully you) entered your password. Enter this code to finish logging in.",
    footer: (minutes) =>
      `This code expires in ${minutes} minute${minutes === 1 ? "" : "s"}. If this wasn't you, change your password.`,
    logLabel: "Login code"
  }
};

// email clients (Gmail, Outlook) sirf inline styles aur tables theek dikhate hain — isliye yahi pattern
function otpEmailHtml(otp, { heading, intro, footer }) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb">
      <tr><td style="padding:32px 28px;text-align:center">
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827">${heading}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4b5563">${intro}</p>
        <p style="margin:0 0 20px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#111827;font-family:'Courier New',monospace">${otp}</p>
        <p style="margin:0;font-size:13px;color:#9ca3af">${footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

// email ka poora maal (subject, text, html) — alag function taake test bina SMTP ke text check kar sake
function otpEmailContent(otp, purpose) {
  const { subject, heading, intro, footer, logLabel } = OTP_EMAILS[purpose];
  const footerText = footer(Math.round(config.otpTtlMs / 60000));
  return {
    subject,
    logLabel,
    // jo email client HTML na dikhaye uske liye simple text
    text: `${intro}\n\nYour code: ${otp}\n\n${footerText}`,
    html: otpEmailHtml(otp, { heading, intro, footer: footerText })
  };
}

// purpose: "verify-email" (register ke baad) ya "login" (2FA)
async function sendOtpEmail(email, otp, purpose) {
  const content = otpEmailContent(otp, purpose);

  // SMTP nahi — development mein code dekhne ka yahi ek rasta
  // SMTP ho to code kabhi log nahi hota — logs parhne wala code se verify na kar sake
  if (!transporter) {
    console.log(`[dev — SMTP not configured] ${content.logLabel} for ${email}: ${otp}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Tasks API" <${config.smtp.user}>`,
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html
    });
    console.log(`${content.logLabel} email sent to ${email}`);
  } catch (err) {
    // email fail ho to request fail nahi karti — user naya code maang sakta hai (ghante mein 3 tak)
    console.error(`${content.logLabel} email to ${email} failed:`, err.message);
  }
}

// org ka naam / bhejne wale ka naam user ka likha hua hai — HTML mein jaane se pehle escape, warna email mein
// <a href=...> ya <img> ghus sakta (phishing). text wale hisse mein HTML ka sawal nahi
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// invite email — link <FRONTEND_URL>/invitations/<token>; 48 ghante ka zikr Invitation model ki muddat se
function inviteEmailContent({ orgName, role, inviterName, url, expiresInHours }) {
  const subject = `You're invited to join ${orgName} on TaskDesk`;
  const intro = `${inviterName} invited you to join ${orgName} as ${role === "admin" ? "an" : "a"} ${role}.`;
  const footer = `This invitation expires in ${expiresInHours} hours and can be used once. Log in with this email address to accept it. If you weren't expecting it, you can ignore this email.`;
  const safe = { intro: escapeHtml(intro), url: escapeHtml(url), footer: escapeHtml(footer) };
  return {
    subject,
    text: `${intro}\n\nAccept the invitation: ${url}\n\n${footer}`,
    html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb">
      <tr><td style="padding:32px 28px;text-align:center">
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827">You're invited</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563">${safe.intro}</p>
        <a href="${safe.url}" style="display:inline-block;margin:0 0 24px;padding:12px 20px;background:#2563eb;color:#ffffff;border-radius:6px;font-size:15px;font-weight:bold;text-decoration:none">Accept invitation</a>
        <p style="margin:0 0 12px;font-size:12px;color:#6b7280;word-break:break-all">${safe.url}</p>
        <p style="margin:0;font-size:13px;color:#9ca3af">${safe.footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`
  };
}

// await nahi kiya jaata (sendOtpEmail jaisa) — email fail ho to invite phir bhi bana; admin dobara bhej sakta hai
async function sendInviteEmail(email, details) {
  const content = inviteEmailContent(details);

  // SMTP nahi — development mein link dekhne ka yahi rasta (OTP jaisa); SMTP ho to link kabhi log nahi hota
  if (!transporter) {
    console.log(`[dev — SMTP not configured] Invitation link for ${email}: ${details.url}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Tasks API" <${config.smtp.user}>`,
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html
    });
    console.log(`Invitation email sent to ${email}`);
  } catch (err) {
    console.error(`Invitation email to ${email} failed:`, err.message);
  }
}

module.exports = {
  sendOtpEmail,
  otpEmailContent,
  sendInviteEmail,
  inviteEmailContent
};
