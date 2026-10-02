// verification link browser mein khule to JSON ki jagah ye simple page dikhta hai

// resend ka form — link expire/kharab ho to user yahin se naya link mangwa sake
// action relative hai — page backend se hi khulta hai, isliye usi server par jaata hai
const resendForm = `
    <form method="POST" action="/verify/resend" style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;text-align:left">
      <label for="email" style="display:block;font-size:14px;font-weight:600;color:#111827;margin-bottom:6px">Get a new verification link</label>
      <input id="email" name="email" type="email" required placeholder="you@example.com" autocomplete="email"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font:inherit;margin-bottom:10px">
      <button type="submit" style="width:100%;padding:10px 16px;border:none;border-radius:8px;background:#2563eb;color:#fff;font:inherit;font-weight:600;cursor:pointer">Resend verification email</button>
    </form>`;

function verifyPage({ ok, title, message, showResend = false }) {
  const color = ok ? "#16a34a" : "#dc2626";
  const icon = ok ? "&#10003;" : "!";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f5f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:16px;box-sizing:border-box">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:36px 28px;max-width:400px;width:100%;text-align:center">
    <div style="width:56px;height:56px;border-radius:50%;background:${color};color:#fff;font-size:30px;line-height:56px;margin:0 auto 18px">${icon}</div>
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827">${title}</h1>
    <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.5">${message}</p>${showResend ? resendForm : ""}
  </div>
</body>
</html>`;
}

// browser (Accept: text/html) ko page, API client (curl/tests/frontend fetch) ko { message } JSON
// json pehle — "*/*" bhejne wale clients ko JSON hi mile
function respondPage(res, status, { ok, title, message, pageMessage = message, showResend = false }) {
  res.status(status).format({
    json: () => res.json({ message }),
    html: () => res.send(verifyPage({ ok, title, message: pageMessage, showResend })),
    // na JSON maanga na HTML (jaise text/plain) — 406 ki jagah JSON de do
    default: () => res.json({ message })
  });
}

module.exports = {
  verifyPage,
  respondPage
};
