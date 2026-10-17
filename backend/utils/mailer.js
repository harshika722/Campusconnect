// Email bhejta hai. 3 mode (is order mein):
//   1. BREVO_API_KEY set  -> Brevo HTTPS API (Render free tier par SMTP block hota hai, wahan ye use karo)
//   2. SMTP_HOST set      -> nodemailer SMTP (local test, Gmail App Password)
//   3. kuch set nahi      -> sirf development: email backend terminal mein print hoti hai
const nodemailer = require("nodemailer");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function parseFrom() {
  const raw = process.env.MAIL_FROM || "CampusConnect <no-reply@campusconnect.local>";
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, "") || "CampusConnect", email: m[2] } : { name: "CampusConnect", email: raw.trim() };
}

// Link ka base hamesha apne .env se aata hai, request se nahi (Host-header attack se bachne ke liye)
function resetLink(token) {
  const base = (process.env.CLIENT_URL || "http://127.0.0.1:5500/frontend").replace(/\/+$/, "");
  // Token URL ke #fragment mein hai, isliye browser use kisi server ya log ko nahi bhejta
  return `${base}/resetpassword.html#token=${token}`;
}

let smtpTransport = null;
function getSmtp() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return smtpTransport;
}

async function deliver({ to, subject, text, html }) {
  const from = parseFrom();

  if (process.env.BREVO_API_KEY) {
    const res = await fetch(process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: from, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    });
    if (!res.ok) throw new Error("Brevo API error " + res.status);
    return;
  }

  if (process.env.SMTP_HOST) {
    await getSmtp().sendMail({ from: `"${from.name}" <${from.email}>`, to, subject, text, html });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email is not configured (set BREVO_API_KEY or SMTP_HOST)");
  }
  console.log("\n[DEV EMAIL - no mail provider configured]\nTo: " + to + "\nSubject: " + subject + "\n" + text + "\n");
}

async function sendPasswordResetEmail(to, name, token) {
  const link = resetLink(token);
  await deliver({
    to,
    subject: "Reset your CampusConnect password",
    text:
      `Hi ${name},\n\nWe received a request to reset your CampusConnect password.\n` +
      `Open this link within 15 minutes to choose a new one:\n\n${link}\n\n` +
      `If you did not ask for this, you can ignore this email. Your password will not change.`,
    html:
      `<p>Hi ${esc(name)},</p><p>We received a request to reset your CampusConnect password.</p>` +
      `<p><a href="${esc(link)}">Choose a new password</a> (valid for 15 minutes, one use only).</p>` +
      `<p>If you did not ask for this, you can ignore this email. Your password will not change.</p>`,
  });
}

async function sendPasswordChangedEmail(to, name) {
  await deliver({
    to,
    subject: "Your CampusConnect password was changed",
    text: `Hi ${name},\n\nYour CampusConnect password was just changed. If this was not you, reset it again immediately.`,
    html: `<p>Hi ${esc(name)},</p><p>Your CampusConnect password was just changed. If this was not you, reset it again immediately.</p>`,
  });
}

module.exports = { sendPasswordResetEmail, sendPasswordChangedEmail, resetLink };