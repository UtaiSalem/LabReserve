const nodemailer = require("nodemailer");

const HOST = process.env.MAIL_HOST || "";
const PORT = Number(process.env.MAIL_PORT || 587);
const USER = process.env.MAIL_USERNAME || "";
const PASS = process.env.MAIL_PASSWORD || "";
const FROM = process.env.MAIL_FROM_ADDRESS || "no-reply@labreserve.local";
const FROM_NAME = process.env.MAIL_FROM_NAME || "LabReserve";
const ENABLED = (process.env.MAIL_ENABLED || (HOST ? "true" : "false")).toLowerCase() === "true";
const DRY_RUN = (process.env.MAIL_DRY_RUN || "").toLowerCase() === "true";
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 8775}`;

let transporter = null;
const sentLog = [];

function getTransporter() {
  if (transporter) return transporter;
  if (!ENABLED || DRY_RUN) {
    transporter = {
      sendMail: async (opts) => {
        sentLog.push({ ...opts, sentAt: new Date().toISOString() });
        console.log(`[mailer] (dry-run) to=${opts.to} subject=${opts.subject}`);
        return { messageId: `dryrun-${Date.now()}` };
      }
    };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: USER ? { user: USER, pass: PASS } : undefined
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return { skipped: "no-recipient" };
  const tx = getTransporter();
  return tx.sendMail({
    from: `"${FROM_NAME}" <${FROM}>`,
    to,
    subject,
    html,
    text: text || stripHtml(html)
  });
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function bilingual(th, en) {
  return { th, en };
}

function layout(body) {
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f8fa;padding:20px;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
${body}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="color:#64748b;font-size:12px;margin:0">LabReserve · Scientific Instrument Booking System</p>
</div></body></html>`;
}

function bookingRow(booking) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:6px 0;color:#64748b">เครื่องมือ / Tool</td><td style="padding:6px 0">${escapeHtml(booking.tool)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">ผู้ขอใช้ / Requester</td><td style="padding:6px 0">${escapeHtml(booking.requester)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">หน่วยงาน / Department</td><td style="padding:6px 0">${escapeHtml(booking.department || "-")}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">เริ่ม / Start</td><td style="padding:6px 0">${escapeHtml(booking.start)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">สิ้นสุด / End</td><td style="padding:6px 0">${escapeHtml(booking.end)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;vertical-align:top">วัตถุประสงค์ / Purpose</td><td style="padding:6px 0">${escapeHtml(booking.purpose)}</td></tr>
    </table>`;
}

function approverEmail({ approver, booking, approveToken, rejectToken }) {
  const approveUrl = `${APP_URL}/approval/email?token=${encodeURIComponent(approveToken)}&action=approve`;
  const rejectUrl = `${APP_URL}/approval/email?token=${encodeURIComponent(rejectToken)}&action=reject`;
  const loginUrl = `${APP_URL}/`;
  const subject = `[LabReserve] คำขอจองใหม่ · New booking request — ${booking.tool}`;
  const html = layout(`
    <h2 style="margin:0 0 8px">มีคำขอจองใหม่รออนุมัติ</h2>
    <h3 style="margin:0 0 16px;color:#475569;font-weight:500">New booking request awaiting approval</h3>
    <p>เรียน ${escapeHtml(approver.name)},<br><span style="color:#64748b">Dear ${escapeHtml(approver.name)},</span></p>
    <p>มีคำขอจองเครื่องมือใหม่ที่ต้องพิจารณา<br><span style="color:#64748b">A new instrument booking request needs your decision.</span></p>
    ${bookingRow(booking)}
    <div style="margin:24px 0;text-align:center">
      <a href="${approveUrl}" style="display:inline-block;background:#0f766e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:4px;font-weight:600">อนุมัติ / Approve</a>
      <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:4px;font-weight:600">ไม่อนุมัติ / Reject</a>
    </div>
    <p style="color:#64748b;font-size:13px">หรือเข้าสู่ระบบเพื่อพิจารณา / Or sign in to review: <a href="${loginUrl}">${escapeHtml(loginUrl)}</a></p>
    <p style="color:#64748b;font-size:12px">ลิงก์จะหมดอายุใน 72 ชั่วโมง / These links expire in 72 hours.</p>
  `);
  return { subject, html };
}

function bookingDecisionEmail({ booking, decision, reason }) {
  const isApproved = decision === "approved";
  const subject = isApproved
    ? `[LabReserve] คำขอของคุณได้รับอนุมัติ · Your booking was approved — ${booking.tool}`
    : `[LabReserve] คำขอของคุณไม่ได้รับอนุมัติ · Your booking was rejected — ${booking.tool}`;
  const reasonBlock = !isApproved && reason
    ? `<p style="background:#fef2f2;border-left:4px solid #dc2626;padding:10px;border-radius:6px"><strong>เหตุผล / Reason:</strong><br>${escapeHtml(reason)}</p>`
    : "";
  const html = layout(`
    <h2 style="margin:0 0 8px;color:${isApproved ? "#0f766e" : "#b91c1c"}">${isApproved ? "คำขอของคุณได้รับอนุมัติแล้ว" : "คำขอของคุณไม่ได้รับอนุมัติ"}</h2>
    <h3 style="margin:0 0 16px;color:#475569;font-weight:500">${isApproved ? "Your booking has been approved" : "Your booking was rejected"}</h3>
    ${bookingRow(booking)}
    ${reasonBlock}
    <p style="color:#64748b;font-size:13px">หากต้องการดูรายละเอียดเพิ่มเติม กรุณาเข้าสู่ระบบ<br>Sign in for more details: <a href="${APP_URL}/">${escapeHtml(APP_URL)}/</a></p>
  `);
  return { subject, html };
}

function welcomeEmail({ user }) {
  return {
    subject: "[LabReserve] ยินดีต้อนรับ · Welcome",
    html: layout(`
      <h2>ยินดีต้อนรับสู่ LabReserve</h2>
      <h3 style="color:#475569;font-weight:500">Welcome to LabReserve</h3>
      <p>เรียน ${escapeHtml(user.name)},<br><span style="color:#64748b">Dear ${escapeHtml(user.name)},</span></p>
      <p>บัญชีของคุณถูกสร้างแล้ว · Your account has been created.</p>
      <p>ชื่อผู้ใช้ / Username: <strong>${escapeHtml(user.username)}</strong></p>
      <p><a href="${APP_URL}/" style="display:inline-block;background:#0f766e;color:white;padding:10px 20px;border-radius:8px;text-decoration:none">เข้าสู่ระบบ / Sign in</a></p>
    `)
  };
}

function passwordChangedEmail({ user, changedBy }) {
  return {
    subject: "[LabReserve] รหัสผ่านถูกเปลี่ยน · Password changed",
    html: layout(`
      <h2>รหัสผ่านของคุณถูกเปลี่ยน</h2>
      <h3 style="color:#475569;font-weight:500">Your password has been changed</h3>
      <p>${escapeHtml(changedBy)} ได้รีเซ็ตรหัสผ่านของบัญชี ${escapeHtml(user.username)}<br>
      <span style="color:#64748b">${escapeHtml(changedBy)} reset the password for account ${escapeHtml(user.username)}.</span></p>
      <p>หากไม่ใช่คุณ กรุณาแจ้งผู้ดูแลระบบทันที / If this wasn't you, contact your admin immediately.</p>
    `)
  };
}

module.exports = {
  sendMail,
  approverEmail,
  bookingDecisionEmail,
  welcomeEmail,
  passwordChangedEmail,
  bilingual,
  sentLog,
  isEnabled: () => ENABLED && !DRY_RUN,
  appUrl: () => APP_URL
};
