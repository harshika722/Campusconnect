
const nodemailer = require("nodemailer");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function parseFrom() {
  const raw = process.env.MAIL_FROM || "CampusConnect <no-reply@campusconnect.local>";
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);

  return m
    ? {
        name: m[1].replace(/^"|"$/g, "") || "CampusConnect",
        email: m[2],
      }
    : { name: "CampusConnect", email: raw.trim() };
}

// Password reset link
function resetLink(token) {
  const base = (
    process.env.CLIENT_URL || "http://127.0.0.1:5500/frontend"
  ).replace(/\/+$/, "");

  return `${base}/resetpassword.html#token=${token}`;
}

let smtpTransport = null;

function getSmtp() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  return smtpTransport;
}

// Shared email delivery: Brevo API, SMTP, or development console
async function deliver({ to, subject, text, html }) {
  const from = parseFrom();

  if (process.env.BREVO_API_KEY) {
    const res = await fetch(
      process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: from,
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      }
    );

    if (!res.ok) {
      throw new Error("Brevo API error " + res.status);
    }

    return;
  }

  if (process.env.SMTP_HOST) {
    await getSmtp().sendMail({
      from: `"${from.name}" <${from.email}>`,
      to,
      subject,
      text,
      html,
    });

    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Email is not configured (set BREVO_API_KEY or SMTP_HOST)"
    );
  }

  console.log(
    "\n[DEV EMAIL - no mail provider configured]\n" +
      "To: " + to + "\n" +
      "Subject: " + subject + "\n" +
      text + "\n"
  );
}

// NEW: Signup OTP email
async function sendSignupOtpEmail(to, name, otp) {
  await deliver({
    to,
    subject: "Verify your CampusConnect email",
    text:
      `Hi ${name},\n\n` +
      `Your CampusConnect verification code is: ${otp}\n\n` +
      `This code expires in 10 minutes.\n\n` +
      `If you did not request this, please ignore this email.`,
    html:
      `<p>Hi ${esc(name)},</p>` +
      `<p>Your CampusConnect verification code is:</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;">` +
      `<strong>${esc(otp)}</strong></p>` +
      `<p>This code expires in 10 minutes.</p>` +
      `<p>If you did not request this, please ignore this email.</p>`,
  });
}

// Existing: Forgot password email
async function sendPasswordResetEmail(to, name, token) {
  const link = resetLink(token);

  await deliver({
    to,
    subject: "Reset your CampusConnect password",
    text:
      `Hi ${name},\n\n` +
      `We received a request to reset your CampusConnect password.\n` +
      `Open this link within 15 minutes to choose a new one:\n\n` +
      `${link}\n\n` +
      `If you did not ask for this, you can ignore this email. Your password will not change.`,
    html:
      `<p>Hi ${esc(name)},</p>` +
      `<p>We received a request to reset your CampusConnect password.</p>` +
      `<p><a href="${esc(link)}">Choose a new password</a> ` +
      `(valid for 15 minutes, one use only).</p>` +
      `<p>If you did not ask for this, you can ignore this email. Your password will not change.</p>`,
  });
}

// Existing: Password changed notification
async function sendPasswordChangedEmail(to, name) {
  await deliver({
    to,
    subject: "Your CampusConnect password was changed",
    text:
      `Hi ${name},\n\n` +
      `Your CampusConnect password was just changed. ` +
      `If this was not you, reset it again immediately.`,
    html:
      `<p>Hi ${esc(name)},</p>` +
      `<p>Your CampusConnect password was just changed. ` +
      `If this was not you, reset it again immediately.</p>`,
  });
}
async function sendSignupOtpEmail(to, name, otp) {
  await deliver({
    to,
    subject: "Your CampusConnect verification code",
    text:
      `Hi ${name},\n\nYour CampusConnect verification code is: ${otp}\n\n` +
      `It expires in 10 minutes. If you did not try to sign up, you can ignore this email.`,
    html:
      `<p>Hi ${esc(name)},</p><p>Your CampusConnect verification code is:</p>` +
      `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${esc(otp)}</p>` +
      `<p>It expires in 10 minutes. If you did not try to sign up, you can ignore this email.</p>`,
  });
}

module.exports = module.exports = { sendPasswordResetEmail, sendPasswordChangedEmail, sendSignupOtpEmail, resetLink };
