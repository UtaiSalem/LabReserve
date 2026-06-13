const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { initRepo, verifyPassword } = require("./db");
const mailer = require("./mailer");

const TOKEN_TTL_SECONDS = Number(process.env.APPROVAL_TOKEN_TTL || 72 * 3600);

const PORT = Number(process.env.PORT || 8775);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DB_FILE = path.join(DATA_DIR, "labreserve.db");
const LEGACY_JSON = path.join(DATA_DIR, "labreserve-db.json");
const SESSION_COOKIE = "labreserve_session";
const CSRF_COOKIE = "labreserve_csrf";
const CSRF_HEADER = "x-csrf-token";
const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS || 28800);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOGIN_RATE_LIMIT = Number(process.env.LOGIN_RATE_LIMIT || 10);
const API_RATE_LIMIT = Number(process.env.API_RATE_LIMIT || 240);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateLimits = new Map();

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  console.warn("WARNING: SESSION_SECRET is not set. Set it in production to keep sessions valid after restarts.");
}

const toolConfig = {
  "HPLC Agilent 1260": { approver: "รองคณบดีฝ่ายวิจัย", staff: "เจ้าหน้าที่เคมีวิเคราะห์", channels: ["email", "line", "teams"] },
  "GC-MS Shimadzu QP2020": { approver: "หัวหน้าศูนย์เครื่องมือ", staff: "เจ้าหน้าที่มวลสาร", channels: ["email", "teams"] },
  "SEM JEOL JSM-IT200": { approver: "ผู้จัดการห้องปฏิบัติการวัสดุ", staff: "เจ้าหน้าที่กล้องจุลทรรศน์", channels: ["email", "line"] },
  "FTIR Bruker Alpha": { approver: "หัวหน้าห้องสเปกโทรสโกปี", staff: "เจ้าหน้าที่สเปกโทรสโกปี", channels: ["email", "line", "teams"] }
};

const channelLabels = { email: "Email", line: "LINE", teams: "Microsoft Teams" };
const TOOLS = Object.keys(toolConfig);

let repo;
const repoReady = initRepo({ jsonPath: LEGACY_JSON }).then(({ repo: readyRepo }) => {
  repo = readyRepo;
  return readyRepo;
});

async function getRepo() {
  return repo || repoReady;
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self' http://127.0.0.1:8775; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'"
  };
}

function requestOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
}

function allowedCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (origin === requestOrigin(req) || ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

function corsHeaders(req) {
  const origin = allowedCorsOrigin(req);
  return origin ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": `Content-Type, ${CSRF_HEADER}`
  } : {};
}

function isStateChanging(method) {
  return ["POST", "PATCH", "DELETE"].includes(method);
}

function rejectBadOrigin(req, res) {
  if (!isStateChanging(req.method) || !req.headers.origin || allowedCorsOrigin(req)) return false;
  json(res, 403, { error: "origin not allowed" });
  return true;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimit(req, bucket, limit, windowMs) {
  const now = Date.now();
  const key = `${bucket}:${clientIp(req)}`;
  const current = rateLimits.get(key);
  if (!current || current.reset <= now) {
    rateLimits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, value] of rateLimits) {
    if (value.reset <= now) rateLimits.delete(key);
  }
}

function setHeaders(res, extra) {
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
}

function json(res, status, payload) {
  res.writeHead(status, {
    ...securityHeaders(),
    ...corsHeaders(res.req),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function signSession(user) {
  const payload = Buffer.from(JSON.stringify({
    user: { username: user.username, role: user.role, name: user.name },
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!session.exp || session.exp <= Date.now()) return null;
  return session.user || null;
}

function secureCookie(req) {
  return process.env.SECURE_COOKIES === "true" || req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
}

function sessionCookie(req, value, maxAge) {
  const secure = secureCookie(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function csrfCookie(req, value, maxAge) {
  const secure = secureCookie(req) ? "; Secure" : "";
  return `${CSRF_COOKIE}=${encodeURIComponent(value)}; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function setCookies(res, cookies) {
  const existing = res.getHeader("Set-Cookie");
  const list = Array.isArray(existing) ? existing.slice() : existing ? [existing] : [];
  for (const c of cookies) list.push(c);
  res.setHeader("Set-Cookie", list);
}

function newCsrfToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function ensureCsrf(req, res) {
  const cookies = parseCookies(req);
  let token = cookies[CSRF_COOKIE];
  if (!token) {
    token = newCsrfToken();
    setCookies(res, [csrfCookie(req, token, SESSION_MAX_AGE_SECONDS)]);
  }
  return token;
}

function verifyCsrf(req) {
  const cookies = parseCookies(req);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  try {
    return verifySession(token);
  } catch {
    return null;
  }
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    json(res, 401, { error: "login required" });
    return null;
  }
  return user;
}

function requireRole(req, res, roles) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    json(res, 403, { error: "permission denied" });
    return null;
  }
  return user;
}

async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function channelSummary(tool) {
  return (toolConfig[tool]?.channels || ["email"]).map((c) => channelLabels[c]).join(", ");
}

async function notify(target, tool, title, message, opts = {}) {
  const repo = await getRepo();
  const config = toolConfig[tool] || {};
  const audience = target.audience || null;
  const recipient_user = target.user || null;
  const recipientLabel = recipient_user
    ? recipient_user
    : audience === "staff"
      ? config.staff
      : audience === "approver"
        ? config.approver
        : audience === "admin"
          ? "ผู้ดูแลระบบ"
          : audience === "requester"
            ? "ผู้จอง"
            : "ระบบ";
  const channelText = tool ? ` · ส่งถึง ${recipientLabel} ผ่าน ${channelSummary(tool)}` : ` · ส่งถึง ${recipientLabel}`;
  await repo.addNotification({
    id: crypto.randomUUID(),
    audience,
    recipient_user,
    title,
    message: `${message}${channelText}`,
    time: new Date().toLocaleString("th-TH"),
    category: opts.category || null,
    related_type: opts.related_type || (tool ? "booking" : null),
    related_id: opts.related_id || null,
    severity: opts.severity || "info"
  });
}

async function audit(req, user, action, extra = {}) {
  const repo = await getRepo();
  await repo.audit({
    actor: user?.username || extra.actor || null,
    role: user?.role || null,
    ip: clientIp(req),
    action,
    target_type: extra.target_type || null,
    target_id: extra.target_id || null,
    details: extra.details || null
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(s) {
  return typeof s === "string" && /^[a-zA-Z0-9_.-]{3,32}$/.test(s);
}

async function dispatchBookingEmails(booking) {
  const repo = await getRepo();
  const approvers = await repo.approversForTool(booking.tool);
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const sends = [];
  for (const approver of approvers) {
    if (!approver.email) continue;
    const approveToken = crypto.randomBytes(32).toString("base64url");
    const rejectToken = crypto.randomBytes(32).toString("base64url");
    await repo.insertApprovalToken({
      id: crypto.randomUUID(),
      booking_id: booking.id,
      approver_username: approver.username,
      token_hash: hashToken(approveToken),
      action: "approve",
      expires_at: expiresAt
    });
    await repo.insertApprovalToken({
      id: crypto.randomUUID(),
      booking_id: booking.id,
      approver_username: approver.username,
      token_hash: hashToken(rejectToken),
      action: "reject",
      expires_at: expiresAt
    });
    const { subject, html } = mailer.approverEmail({ approver, booking, approveToken, rejectToken });
    sends.push(mailer.sendMail({ to: approver.email, subject, html }).catch((err) => console.error("[mail] approver send failed:", err.message)));
  }
  await Promise.allSettled(sends);
}

async function sendDecisionEmail(booking, decision, reason) {
  if (!booking.created_by) return;
  const repo = await getRepo();
  const requester = await repo.findUser(booking.created_by);
  if (!requester || !requester.email) return;
  const { subject, html } = mailer.bookingDecisionEmail({ booking, decision, reason });
  try {
    await mailer.sendMail({ to: requester.email, subject, html });
  } catch (err) {
    console.error("[mail] decision send failed:", err.message);
  }
}

function validateBooking(input) {
  const required = ["requester", "department", "tool", "start", "end", "purpose"];
  for (const key of required) {
    if (!input[key]) return `${key} is required`;
  }
  if (!toolConfig[input.tool]) return "unknown tool";
  if (new Date(input.end) <= new Date(input.start)) return "end must be after start";
  return null;
}

async function snapshot(user) {
  const repo = await getRepo();
  const audience = user ? { username: user.username, role: user.role } : { username: "__anon__", role: "__none__" };
  return {
    tools: TOOLS,
    bookings: await repo.listBookings(),
    notifications: user ? await repo.listNotifications(audience) : [],
    unreadCount: user ? await repo.unreadCount(audience) : 0,
    toolConfig
  };
}

async function api(req, res, url) {
  const repo = await getRepo();
  if (rejectBadOrigin(req, res)) return;
  if (!rateLimit(req, "api", API_RATE_LIMIT, 60_000)) {
    return json(res, 429, { error: "too many requests" });
  }

  ensureCsrf(req, res);

  const csrfExempt = ["/api/login", "/api/register", "/api/approval/confirm"];
  if (isStateChanging(req.method) && !csrfExempt.includes(url.pathname) && !verifyCsrf(req)) {
    return json(res, 403, { error: "invalid csrf token" });
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    if (!rateLimit(req, "register", 10, 60 * 60_000)) {
      return json(res, 429, { error: "too many registrations" });
    }
    const { username, password, name, email, department } = await bodyJson(req);
    if (!isValidUsername(username)) return json(res, 400, { error: "username 3-32 chars, letters/digits/._-" });
    if (!password || password.length < 8) return json(res, 400, { error: "password must be at least 8 characters" });
    if (!isValidEmail(email)) return json(res, 400, { error: "invalid email" });
    if (!name || !name.trim()) return json(res, 400, { error: "name required" });
    if (await repo.findUser(username)) return json(res, 409, { error: "username already taken" });
    if (await repo.findUserByEmail(email)) return json(res, 409, { error: "email already registered" });
    await repo.createUser({
      username,
      password,
      role: "requester",
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department ? department.trim() : null
    });
    await audit(req, null, "user.registered", { target_type: "user", target_id: username });
    try {
      const created = await repo.findUser(username);
      const { subject, html } = mailer.welcomeEmail({ user: created });
      await mailer.sendMail({ to: created.email, subject, html });
    } catch (err) {
      console.error("[mail] welcome send failed:", err.message);
    }
    const created = await repo.findUser(username);
    const token = signSession(created);
    const csrfToken = newCsrfToken();
    setCookies(res, [
      sessionCookie(req, token, SESSION_MAX_AGE_SECONDS),
      csrfCookie(req, csrfToken, SESSION_MAX_AGE_SECONDS)
    ]);
    return json(res, 201, { user: repo.publicUser(created) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    if (!rateLimit(req, "login", LOGIN_RATE_LIMIT, 5 * 60_000)) {
      return json(res, 429, { error: "too many login attempts" });
    }
    const { username, password } = await bodyJson(req);
    const user = await repo.findUser(username);
    if (!user || !password || !verifyPassword(password, user)) {
      await audit(req, null, "login.failed", { details: { username: username || null } });
      const ip = clientIp(req);
      const fails = await repo.recentLoginFailures(ip, Date.now() - 15 * 60 * 1000);
      if (fails === 5) {
        await notify({ audience: "admin" }, null, "ตรวจพบ login ผิดซ้ำ", `IP ${ip} ล้มเหลว ${fails} ครั้งใน 15 นาที`, { category: "security.login_failed", severity: "critical" });
      }
      return json(res, 401, { error: "invalid username or password" });
    }
    const token = signSession(user);
    const csrfToken = newCsrfToken();
    setCookies(res, [
      sessionCookie(req, token, SESSION_MAX_AGE_SECONDS),
      csrfCookie(req, csrfToken, SESSION_MAX_AGE_SECONDS)
    ]);
    await audit(req, user, "login.success");
    return json(res, 200, { user: repo.publicUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const user = currentUser(req);
    if (user) await audit(req, user, "logout");
    setCookies(res, [sessionCookie(req, "", 0)]);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    return json(res, 200, { user: currentUser(req) || null });
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const user = requireUser(req, res);
    if (!user) return;
    return json(res, 200, await snapshot(user));
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    return json(res, 200, { users: await repo.listUsers() });
  }

  if (req.method === "GET" && url.pathname === "/api/tool-approvers") {
    const user = requireUser(req, res);
    if (!user) return;
    return json(res, 200, { entries: await repo.listToolApprovers() });
  }

  if (req.method === "POST" && url.pathname === "/api/tool-approvers") {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const { tool, approver_username } = await bodyJson(req);
    if (!tool || !approver_username) return json(res, 400, { error: "tool and approver_username required" });
    if (!TOOLS.includes(tool)) return json(res, 400, { error: "unknown tool" });
    const target = await repo.findUser(approver_username);
    if (!target) return json(res, 404, { error: "user not found" });
    await repo.addToolApprover(tool, approver_username);
    await audit(req, user, "tool_approver.added", { target_type: "tool_approver", target_id: `${tool}|${approver_username}` });
    return json(res, 200, { entries: await repo.listToolApprovers() });
  }

  if (req.method === "DELETE" && url.pathname === "/api/tool-approvers") {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const { tool, approver_username } = await bodyJson(req);
    if (!tool || !approver_username) return json(res, 400, { error: "tool and approver_username required" });
    await repo.removeToolApprover(tool, approver_username);
    await audit(req, user, "tool_approver.removed", { target_type: "tool_approver", target_id: `${tool}|${approver_username}` });
    return json(res, 200, { entries: await repo.listToolApprovers() });
  }

  const profileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
  if (req.method === "PATCH" && profileMatch) {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const username = decodeURIComponent(profileMatch[1]);
    const target = await repo.findUser(username);
    if (!target) return json(res, 404, { error: "user not found" });
    const { name, email, department, active } = await bodyJson(req);
    if (email !== undefined && email !== null && email !== "" && !isValidEmail(email)) {
      return json(res, 400, { error: "invalid email" });
    }
    if (email && email !== target.email) {
      const existing = await repo.findUserByEmail(email.toLowerCase());
      if (existing && existing.username !== username) return json(res, 409, { error: "email already used" });
    }
    await repo.updateUserProfile(username, {
      name: name ? name.trim() : undefined,
      email: email !== undefined ? (email ? email.toLowerCase().trim() : null) : undefined,
      department: department !== undefined ? (department ? department.trim() : null) : undefined,
      active: active !== undefined ? !!active : undefined
    });
    await audit(req, user, "user.profile_updated", { target_type: "user", target_id: username, details: { name: !!name, email: email !== undefined, active: active !== undefined } });
    return json(res, 200, { user: repo.publicUser(await repo.findUser(username)), users: await repo.listUsers() });
  }

  if (req.method === "POST" && url.pathname === "/api/approval/confirm") {
    if (!rateLimit(req, "approval", 60, 60_000)) {
      return json(res, 429, { error: "too many requests" });
    }
    const { token, action, reason } = await bodyJson(req);
    if (!token || !["approve", "reject"].includes(action)) return json(res, 400, { error: "token and action required" });
    const tokenHash = hashToken(token);
    const row = await repo.findApprovalTokenByHash(tokenHash);
    if (!row) return json(res, 404, { error: "token not found" });
    if (row.used_at) return json(res, 410, { error: "token already used" });
    if (row.expires_at * 1000 < Date.now()) return json(res, 410, { error: "token expired" });
    if (row.action !== action) return json(res, 400, { error: "token-action mismatch" });

    const booking = await repo.findBooking(row.booking_id);
    if (!booking) return json(res, 404, { error: "booking not found" });
    if (booking.status !== "pending") {
      return json(res, 409, { error: "booking already finalized", status: booking.status });
    }

    const approver = await repo.findUser(row.approver_username);
    if (!approver) return json(res, 404, { error: "approver not found" });

    if (action === "approve") {
      const conflict = await repo.findConflict(booking, booking.id);
      if (conflict) return json(res, 409, { error: "conflict", conflict });
      await repo.updateBookingStatus(booking.id, "approved");
      booking.status = "approved";
      await notify({ audience: "staff" }, booking.tool, "คำขอได้รับอนุมัติ (จากอีเมล)", `${booking.tool} ของ ${booking.requester} ได้รับอนุมัติ`, { category: "booking.approved", related_id: booking.id });
      if (booking.created_by) {
        await notify({ user: booking.created_by }, booking.tool, "คำขอของคุณได้รับอนุมัติ", `${booking.tool} ช่วง ${booking.start} ถึง ${booking.end} ได้รับอนุมัติแล้ว`, { category: "booking.approved", related_id: booking.id });
      }
      sendDecisionEmail(booking, "approved", null);
    } else {
      const cleanReason = (reason || "").trim();
      if (!cleanReason) return json(res, 400, { error: "reason required for rejection" });
      await repo.rejectBooking(booking.id, cleanReason);
      booking.status = "rejected";
      booking.rejection_reason = cleanReason;
      await notify({ audience: "approver" }, booking.tool, "บันทึกผลไม่อนุมัติ (จากอีเมล)", `${booking.tool} ของ ${booking.requester} ถูกบันทึกเป็นไม่อนุมัติ`, { category: "booking.rejected", related_id: booking.id });
      if (booking.created_by) {
        await notify({ user: booking.created_by }, booking.tool, "คำขอของคุณไม่ได้รับอนุมัติ", `เหตุผล: ${cleanReason}`, { category: "booking.rejected", related_id: booking.id, severity: "warning" });
      }
      sendDecisionEmail(booking, "rejected", cleanReason);
    }

    await repo.markApprovalTokenUsed(row.id, approver.username);
    await repo.invalidateTokensForBooking(booking.id);
    await audit(req, approver, `booking.${booking.status}.via_email`, { target_type: "booking", target_id: booking.id, details: { reason: action === "reject" ? reason : undefined } });
    return json(res, 200, { booking });
  }

  if (req.method === "GET" && url.pathname === "/api/approval/preview") {
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action");
    if (!token || !action) return json(res, 400, { error: "token and action required" });
    const row = await repo.findApprovalTokenByHash(hashToken(token));
    if (!row) return json(res, 404, { error: "token not found" });
    const booking = await repo.findBooking(row.booking_id);
    if (!booking) return json(res, 404, { error: "booking not found" });
    const approver = await repo.findUser(row.approver_username);
    return json(res, 200, {
      booking,
      approver: approver ? { name: approver.name, username: approver.username } : null,
      action: row.action,
      expired: row.expires_at * 1000 < Date.now(),
      used: !!row.used_at,
      finalized: booking.status !== "pending"
    });
  }

  if (req.method === "GET" && url.pathname === "/api/audit") {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const limit = Math.min(500, Number(url.searchParams.get("limit")) || 100);
    return json(res, 200, { entries: await repo.listAudit(limit) });
  }

  const passwordMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);
  if (req.method === "PATCH" && passwordMatch) {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const username = decodeURIComponent(passwordMatch[1]);
    const target = await repo.findUser(username);
    if (!target) return json(res, 404, { error: "user not found" });
    const { password } = await bodyJson(req);
    if (!password || password.length < 8) return json(res, 400, { error: "password must be at least 8 characters" });
    await repo.setPassword(username, password);
    await audit(req, user, "user.password_changed", { target_type: "user", target_id: username });
    await notify({ user: username }, null, "รหัสผ่านของคุณถูกเปลี่ยน", `ผู้ดูแลระบบ ${user.username} ได้รีเซ็ตรหัสผ่านของคุณ`, { category: "user.password_changed", severity: "warning" });
    if (username !== user.username) {
      await notify({ audience: "admin" }, null, "เปลี่ยนรหัสผ่านผู้ใช้", `${user.username} เปลี่ยนรหัสของ ${username}`, { category: "user.password_changed", severity: "info" });
    }
    return json(res, 200, { user: repo.publicUser(target), users: await repo.listUsers() });
  }

  if (req.method === "POST" && url.pathname === "/api/bookings") {
    const user = requireRole(req, res, ["admin", "requester", "approver", "staff"]);
    if (!user) return;
    const input = await bodyJson(req);
    const error = validateBooking(input);
    if (error) return json(res, 400, { error });

    const booking = {
      id: crypto.randomUUID(),
      requester: input.requester.trim(),
      department: input.department.trim(),
      tool: input.tool,
      start: input.start,
      end: input.end,
      purpose: input.purpose.trim(),
      status: "pending",
      staffStatus: "waiting",
      created_by: user.username
    };
    const conflict = await repo.findConflict(booking);
    if (conflict) return json(res, 409, { error: "conflict", conflict });

    await repo.insertBooking(booking);
    await notify({ audience: "approver" }, booking.tool, "มีคำขอจองใหม่", `${booking.requester} ขอใช้ ${booking.tool}`, { category: "booking.created", related_id: booking.id });
    await notify({ audience: "staff" }, booking.tool, "แจ้งเจ้าหน้าที่ล่วงหน้า", `${booking.tool} มีคำขอใหม่ที่รออนุมัติ`, { category: "booking.created", related_id: booking.id });
    await audit(req, user, "booking.created", { target_type: "booking", target_id: booking.id, details: { tool: booking.tool, start: booking.start, end: booking.end } });
    dispatchBookingEmails(booking).catch((err) => console.error("[mail] dispatch failed:", err.message));
    return json(res, 201, { booking, data: await snapshot(user) });
  }

  const statusMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const user = requireRole(req, res, ["admin", "approver"]);
    if (!user) return;
    const { status } = await bodyJson(req);
    if (!["approved", "rejected"].includes(status)) return json(res, 400, { error: "invalid status" });
    const booking = await repo.findBooking(statusMatch[1]);
    if (!booking) return json(res, 404, { error: "not found" });

    if (status === "approved") {
      const conflict = await repo.findConflict(booking, booking.id);
      if (conflict) return json(res, 409, { error: "conflict", conflict });
      await notify({ audience: "staff" }, booking.tool, "คำขอได้รับอนุมัติ", `${booking.tool} ของ ${booking.requester} ผ่านการอนุมัติแล้ว`, { category: "booking.approved", related_id: booking.id });
      if (booking.created_by) {
        await notify({ user: booking.created_by }, booking.tool, "คำขอของคุณได้รับอนุมัติ", `${booking.tool} ช่วง ${booking.start} ถึง ${booking.end} ได้รับการอนุมัติแล้ว`, { category: "booking.approved", related_id: booking.id, severity: "info" });
      }
    } else {
      await notify({ audience: "approver" }, booking.tool, "บันทึกผลไม่อนุมัติแล้ว", `${booking.tool} ของ ${booking.requester} ถูกบันทึกเป็นไม่อนุมัติ`, { category: "booking.rejected", related_id: booking.id });
      if (booking.created_by) {
        await notify({ user: booking.created_by }, booking.tool, "คำขอของคุณไม่ได้รับอนุมัติ", `${booking.tool} ช่วง ${booking.start} ถึง ${booking.end} ถูกปฏิเสธ`, { category: "booking.rejected", related_id: booking.id, severity: "warning" });
      }
    }

    if (status === "approved") {
      await repo.updateBookingStatus(booking.id, status);
    } else {
      await repo.rejectBooking(booking.id, null);
    }
    booking.status = status;
    await repo.invalidateTokensForBooking(booking.id);
    await audit(req, user, `booking.${status}`, { target_type: "booking", target_id: booking.id });
    sendDecisionEmail(booking, status, null).catch(() => {});
    return json(res, 200, { booking, data: await snapshot(user) });
  }

  const staffMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/staff-status$/);
  if (req.method === "PATCH" && staffMatch) {
    const user = requireRole(req, res, ["admin", "staff"]);
    if (!user) return;
    const { staffStatus } = await bodyJson(req);
    if (!["waiting", "ready", "issue", "calibrate"].includes(staffStatus)) return json(res, 400, { error: "invalid staff status" });
    const booking = await repo.findBooking(staffMatch[1]);
    if (!booking) return json(res, 404, { error: "not found" });
    await repo.updateBookingStaff(booking.id, staffStatus);
    booking.staffStatus = staffStatus;
    const severity = staffStatus === "issue" ? "warning" : "info";
    await notify({ audience: staffStatus === "issue" ? "approver" : "staff" }, booking.tool, "อัปเดตสถานะเจ้าหน้าที่", `${booking.tool} ของ ${booking.requester}: ${staffStatus}`, { category: "booking.staff_status", related_id: booking.id, severity });
    if (booking.created_by && (staffStatus === "ready" || staffStatus === "issue")) {
      await notify({ user: booking.created_by }, booking.tool, "เจ้าหน้าที่อัปเดตสถานะเครื่องมือ", `${booking.tool} ของคุณ: ${staffStatus}`, { category: "booking.staff_status", related_id: booking.id, severity });
    }
    await audit(req, user, "booking.staff_status", { target_type: "booking", target_id: booking.id, details: { staffStatus } });
    return json(res, 200, { booking, data: await snapshot(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/staff/remind") {
    const user = requireRole(req, res, ["admin", "staff", "approver"]);
    if (!user) return;
    for (const booking of await repo.nonReadyBookings()) {
      await notify({ audience: "staff" }, booking.tool, "แจ้งเตือนเจ้าหน้าที่ซ้ำ", `${booking.tool} ของ ${booking.requester} ยังไม่ปิดงาน`, { category: "staff.remind", related_id: booking.id });
    }
    await audit(req, user, "staff.remind_all");
    return json(res, 200, { data: await snapshot(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/seed") {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const booking = {
      id: crypto.randomUUID(),
      requester: "คุณมินตรา",
      department: "ชีวเคมี",
      tool: "FTIR Bruker Alpha",
      start: "2026-06-10T10:00",
      end: "2026-06-10T11:30",
      purpose: "ตรวจสเปกตรัมตัวอย่างโปรตีน",
      status: "pending",
      staffStatus: "waiting"
    };
    const conflict = await repo.findConflict(booking);
    if (conflict) return json(res, 409, { error: "conflict", conflict });
    await repo.insertBooking(booking);
    await notify({ audience: "approver" }, booking.tool, "มีคำขอจองตัวอย่าง", `${booking.tool} มีคำขอรออนุมัติใหม่`, { category: "booking.created", related_id: booking.id });
    await audit(req, user, "booking.seed", { target_type: "booking", target_id: booking.id });
    return json(res, 201, { booking, data: await snapshot(user) });
  }

  if (req.method === "GET" && url.pathname === "/api/notifications/unread-count") {
    const user = requireUser(req, res);
    if (!user) return;
    return json(res, 200, { count: await repo.unreadCount({ username: user.username, role: user.role }) });
  }

  if (req.method === "POST" && url.pathname === "/api/notifications/read-all") {
    const user = requireUser(req, res);
    if (!user) return;
    await repo.markAllRead({ username: user.username, role: user.role });
    return json(res, 200, { data: await snapshot(user) });
  }

  const readMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (req.method === "PATCH" && readMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const meta = await repo.findNotificationMeta(readMatch[1]);
    if (!meta) return json(res, 404, { error: "not found" });
    const isMine = meta.recipient_user === user.username
      || (meta.recipient_user === null && (meta.audience === user.role || meta.audience === null));
    if (!isMine) return json(res, 403, { error: "permission denied" });
    await repo.markRead(meta.id, user.username);
    return json(res, 200, { ok: true, unreadCount: await repo.unreadCount({ username: user.username, role: user.role }) });
  }

  if (req.method === "DELETE" && url.pathname === "/api/notifications") {
    const user = requireRole(req, res, ["admin", "approver", "staff"]);
    if (!user) return;
    await repo.clearNotifications();
    await audit(req, user, "notifications.cleared");
    return json(res, 200, { data: await snapshot(user) });
  }

  return json(res, 404, { error: "not found" });
}

function serveApprovalPage(req, res) {
  const html = `<!doctype html>
<html lang="th"><head>
<meta charset="utf-8">
<title>Approval — LabReserve</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f6f8fa; padding: 24px; color: #0f172a; margin: 0; }
  .card { max-width: 600px; margin: 24px auto; background: white; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin: 0 0 20px; font-size: 15px; color: #64748b; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 0; font-size: 14px; vertical-align: top; }
  td.k { color: #64748b; width: 35%; }
  .btn { display:inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; font-size: 14px; margin: 4px; }
  .btn-primary { background: #0f766e; color: white; }
  .btn-danger { background: #dc2626; color: white; }
  .btn-secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; }
  .alert { padding: 12px; border-radius: 8px; margin: 12px 0; }
  .alert-warn { background: #fef3c7; color: #92400e; }
  .alert-err  { background: #fee2e2; color: #991b1b; }
  .alert-ok   { background: #dcfce7; color: #166534; }
  textarea { width: 100%; min-height: 90px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; box-sizing: border-box; }
  label { display: block; font-weight: 500; margin: 12px 0 6px; font-size: 14px; }
</style>
</head><body>
<div class="card" id="root">กำลังโหลด... / Loading...</div>
<script>
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const action = params.get("action");
  const root = document.getElementById("root");

  function h(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function render(html) { root.innerHTML = html; }

  function renderBooking(b, extra = "") {
    return \`
      <table>
        <tr><td class="k">เครื่องมือ / Tool</td><td>\${h(b.tool)}</td></tr>
        <tr><td class="k">ผู้ขอ / Requester</td><td>\${h(b.requester)}</td></tr>
        <tr><td class="k">หน่วยงาน / Dept</td><td>\${h(b.department || "-")}</td></tr>
        <tr><td class="k">เริ่ม / Start</td><td>\${h(b.start)}</td></tr>
        <tr><td class="k">สิ้นสุด / End</td><td>\${h(b.end)}</td></tr>
        <tr><td class="k">วัตถุประสงค์ / Purpose</td><td>\${h(b.purpose)}</td></tr>
        <tr><td class="k">สถานะปัจจุบัน / Status</td><td>\${h(b.status)}</td></tr>
      </table>\${extra}\`;
  }

  async function load() {
    if (!token || !action) { render('<div class="alert alert-err">ลิงก์ไม่ถูกต้อง / Invalid link</div>'); return; }
    try {
      const r = await fetch(\`/api/approval/preview?token=\${encodeURIComponent(token)}&action=\${encodeURIComponent(action)}\`);
      const data = await r.json();
      if (!r.ok) { render(\`<div class="alert alert-err">\${h(data.error || "Error")}</div>\`); return; }
      if (data.used) { render('<h1>ลิงก์ถูกใช้แล้ว</h1><h2>This link has already been used</h2>' + renderBooking(data.booking)); return; }
      if (data.expired) { render('<h1>ลิงก์หมดอายุ</h1><h2>This link has expired (72 hours)</h2>' + renderBooking(data.booking) + '<p><a class="btn btn-secondary" href="/">เข้าสู่ระบบ / Sign in</a></p>'); return; }
      if (data.finalized) { render('<h1>คำขอนี้ถูกดำเนินการแล้ว</h1><h2>This request has already been finalized</h2>' + renderBooking(data.booking)); return; }
      if (action === "approve") renderApprove(data);
      else renderReject(data);
    } catch (err) {
      render(\`<div class="alert alert-err">โหลดไม่สำเร็จ / Failed to load: \${h(err.message)}</div>\`);
    }
  }

  function renderApprove(data) {
    render(\`
      <h1>ยืนยันการอนุมัติคำขอ</h1>
      <h2>Confirm approval — ผู้อนุมัติ \${h(data.approver?.name || "")}</h2>
      \${renderBooking(data.booking)}
      <div style="margin-top:20px">
        <button class="btn btn-primary" id="confirm">อนุมัติ / Approve</button>
        <a class="btn btn-secondary" href="/">เข้าสู่ระบบเพื่อพิจารณา / Sign in instead</a>
      </div>
      <div id="result"></div>
    \`);
    document.getElementById("confirm").addEventListener("click", () => submit("approve"));
  }

  function renderReject(data) {
    render(\`
      <h1>ยืนยันการไม่อนุมัติคำขอ</h1>
      <h2>Confirm rejection — ผู้อนุมัติ \${h(data.approver?.name || "")}</h2>
      \${renderBooking(data.booking)}
      <label>เหตุผล / Reason <span style="color:#dc2626">*</span></label>
      <textarea id="reason" placeholder="กรุณาระบุเหตุผลที่ไม่อนุมัติ / Please provide a reason"></textarea>
      <div style="margin-top:16px">
        <button class="btn btn-danger" id="confirm">ไม่อนุมัติ / Reject</button>
        <a class="btn btn-secondary" href="/">ยกเลิก / Cancel</a>
      </div>
      <div id="result"></div>
    \`);
    document.getElementById("confirm").addEventListener("click", () => {
      const reason = document.getElementById("reason").value.trim();
      if (!reason) { document.getElementById("result").innerHTML = '<div class="alert alert-warn">กรุณาระบุเหตุผล / Please provide a reason</div>'; return; }
      submit("reject", reason);
    });
  }

  async function submit(action, reason) {
    const btn = document.getElementById("confirm");
    btn.disabled = true; btn.textContent = "กำลังบันทึก... / Saving...";
    try {
      const r = await fetch("/api/approval/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, reason })
      });
      const data = await r.json();
      if (!r.ok) {
        document.getElementById("result").innerHTML = \`<div class="alert alert-err">\${h(data.error || "Error")}</div>\`;
        btn.disabled = false; btn.textContent = action === "approve" ? "อนุมัติ / Approve" : "ไม่อนุมัติ / Reject";
        return;
      }
      render(\`<h1>บันทึกผลเรียบร้อย</h1><h2>Decision recorded</h2>
        <div class="alert alert-ok">สถานะคำขอ: <strong>\${h(data.booking.status)}</strong></div>
        \${renderBooking(data.booking)}
        <p><a class="btn btn-primary" href="/">ไปที่ระบบ / Go to system</a></p>\`);
    } catch (err) {
      document.getElementById("result").innerHTML = \`<div class="alert alert-err">\${h(err.message)}</div>\`;
      btn.disabled = false;
    }
  }

  load();
</script>
</body></html>`;
  res.writeHead(200, { ...securityHeaders(), "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/scientific-instrument-booking.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));
  const relative = path.relative(ROOT, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403, securityHeaders());
    return res.end("Forbidden");
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".css": "text/css; charset=utf-8"
    };
    res.writeHead(200, { ...securityHeaders(), "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, securityHeaders());
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    cleanupRateLimits();
    if (req.method === "OPTIONS") {
      if (req.headers.origin && !allowedCorsOrigin(req)) {
        res.writeHead(403, securityHeaders());
        return res.end();
      }
      res.writeHead(204, { ...securityHeaders(), ...corsHeaders(req) });
      return res.end();
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "LabReserve" });
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname === "/approval/email") return serveApprovalPage(req, res);
    return await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    json(res, error.statusCode || 500, { error: error.statusCode ? error.message : "server error" });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`LabReserve running at http://${HOST}:${PORT}/`);
    console.log(`Database file: ${DB_FILE}`);
  });
}

module.exports = { server, repo };
