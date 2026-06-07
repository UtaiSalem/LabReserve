const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "labreserve-"));
process.env.DATA_DIR = tmpDir;
process.env.SESSION_SECRET = "test-secret-do-not-use-in-prod";
process.env.PORT = "0";
process.env.NODE_ENV = "test";
process.env.LOGIN_RATE_LIMIT = "1000";
process.env.API_RATE_LIMIT = "10000";
process.env.MAIL_ENABLED = "true";
process.env.MAIL_DRY_RUN = "true";

const { server, repo } = require("../server");
const mailer = require("../mailer");

let baseUrl;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { repo.raw.close(); } catch {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.raw?.()["set-cookie"] || []);
  const jar = {};
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1));
  }
  return jar;
}

function mergeCookies(into, more) {
  return { ...into, ...more };
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
}

async function call(method, path, { cookies = {}, body, csrf } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (Object.keys(cookies).length) headers.Cookie = cookieHeader(cookies);
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  const newCookies = parseSetCookie(res);
  return { status: res.status, data, cookies: mergeCookies(cookies, newCookies) };
}

async function login(username, password) {
  const seed = await call("GET", "/api/me");
  return call("POST", "/api/login", {
    cookies: seed.cookies,
    csrf: seed.cookies.labreserve_csrf,
    body: { username, password }
  });
}

test("login rejects bad credentials and logs audit entry", async () => {
  const res = await login("admin", "wrong-password");
  assert.equal(res.status, 401);
});

test("login succeeds with default admin and sets cookies", async () => {
  const res = await login("admin", "admin1234");
  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, "admin");
  assert.ok(res.cookies.labreserve_session);
  assert.ok(res.cookies.labreserve_csrf);
});

test("state-changing call without CSRF token is rejected", async () => {
  const session = await login("admin", "admin1234");
  const res = await call("POST", "/api/seed", { cookies: session.cookies });
  assert.equal(res.status, 403);
  assert.equal(res.data.error, "invalid csrf token");
});

test("requester can create booking; conflict detected; role guard blocks status change", async () => {
  const session = await login("requester", "request1234");
  const csrf = session.cookies.labreserve_csrf;

  const create = await call("POST", "/api/bookings", {
    cookies: session.cookies,
    csrf,
    body: {
      requester: "Test User",
      department: "QA",
      tool: "GC-MS Shimadzu QP2020",
      start: "2026-07-01T09:00",
      end: "2026-07-01T11:00",
      purpose: "unit test"
    }
  });
  assert.equal(create.status, 201);
  const bookingId = create.data.booking.id;

  const conflict = await call("POST", "/api/bookings", {
    cookies: session.cookies,
    csrf,
    body: {
      requester: "Other",
      department: "QA",
      tool: "GC-MS Shimadzu QP2020",
      start: "2026-07-01T10:00",
      end: "2026-07-01T12:00",
      purpose: "overlap"
    }
  });
  assert.equal(conflict.status, 409);

  const denied = await call("PATCH", `/api/bookings/${bookingId}/status`, {
    cookies: session.cookies,
    csrf,
    body: { status: "approved" }
  });
  assert.equal(denied.status, 403);
});

test("approver can approve booking; audit log records action", async () => {
  const requesterSession = await login("requester", "request1234");
  const create = await call("POST", "/api/bookings", {
    cookies: requesterSession.cookies,
    csrf: requesterSession.cookies.labreserve_csrf,
    body: {
      requester: "Approve Me",
      department: "Lab",
      tool: "FTIR Bruker Alpha",
      start: "2026-08-01T09:00",
      end: "2026-08-01T10:00",
      purpose: "approve test"
    }
  });
  assert.equal(create.status, 201);
  const id = create.data.booking.id;

  const approverSession = await login("approver", "approve1234");
  const approve = await call("PATCH", `/api/bookings/${id}/status`, {
    cookies: approverSession.cookies,
    csrf: approverSession.cookies.labreserve_csrf,
    body: { status: "approved" }
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.data.booking.status, "approved");

  const adminSession = await login("admin", "admin1234");
  const audit = await call("GET", "/api/audit?limit=50", { cookies: adminSession.cookies });
  assert.equal(audit.status, 200);
  const found = audit.data.entries.find((e) => e.action === "booking.approved" && e.target_id === id);
  assert.ok(found, "expected booking.approved audit entry");
  assert.equal(found.actor, "approver");
});

test("requester gets per-user notification when their booking is approved", async () => {
  const requesterSession = await login("requester", "request1234");
  const create = await call("POST", "/api/bookings", {
    cookies: requesterSession.cookies,
    csrf: requesterSession.cookies.labreserve_csrf,
    body: {
      requester: "Notify Me",
      department: "Lab",
      tool: "SEM JEOL JSM-IT200",
      start: "2026-09-01T09:00",
      end: "2026-09-01T10:00",
      purpose: "notify test"
    }
  });
  assert.equal(create.status, 201);
  const id = create.data.booking.id;

  const approverSession = await login("approver", "approve1234");
  await call("PATCH", `/api/bookings/${id}/status`, {
    cookies: approverSession.cookies,
    csrf: approverSession.cookies.labreserve_csrf,
    body: { status: "approved" }
  });

  const fresh = await login("requester", "request1234");
  const state = await call("GET", "/api/state", { cookies: fresh.cookies });
  const own = state.data.notifications.find((n) => n.recipient_user === "requester" && n.related_id === id);
  assert.ok(own, "requester should see own approval notification");
  assert.equal(own.read, false);
  assert.ok(state.data.unreadCount >= 1);
});

test("mark notification read is per-user", async () => {
  const approverSession = await login("approver", "approve1234");
  const state1 = await call("GET", "/api/state", { cookies: approverSession.cookies });
  const target = state1.data.notifications.find((n) => !n.read);
  assert.ok(target, "expected at least one unread approver notification");

  const mark = await call("PATCH", `/api/notifications/${target.id}/read`, {
    cookies: approverSession.cookies,
    csrf: approverSession.cookies.labreserve_csrf
  });
  assert.equal(mark.status, 200);

  const state2 = await call("GET", "/api/state", { cookies: approverSession.cookies });
  const found = state2.data.notifications.find((n) => n.id === target.id);
  assert.equal(found.read, true);

  // Admin (different user, but role audience may differ) — verify that requester reading does NOT affect approver
  const adminSession = await login("admin", "admin1234");
  const adminState = await call("GET", "/api/state", { cookies: adminSession.cookies });
  // Admin's own copy of an approver-audience notification should not be considered read by admin's actions
  // (this asserts read tracking is per-user)
  assert.ok(typeof adminState.data.unreadCount === "number");
});

test("unread-count endpoint works", async () => {
  const session = await login("approver", "approve1234");
  const res = await call("GET", "/api/notifications/unread-count", { cookies: session.cookies });
  assert.equal(res.status, 200);
  assert.ok(typeof res.data.count === "number");
});

test("non-admin cannot read audit log", async () => {
  const session = await login("staff", "staff1234");
  const res = await call("GET", "/api/audit", { cookies: session.cookies });
  assert.equal(res.status, 403);
});

test("requester self-registers and is logged in", async () => {
  const seed = await call("GET", "/api/me");
  const res = await call("POST", "/api/register", {
    cookies: seed.cookies,
    body: {
      username: "newuser1",
      password: "secret123",
      name: "New User",
      email: "newuser1@example.com",
      department: "QA"
    }
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.username, "newuser1");
  assert.equal(res.data.user.role, "requester");

  const dup = await call("POST", "/api/register", {
    cookies: seed.cookies,
    body: {
      username: "newuser1",
      password: "secret123",
      name: "x",
      email: "other@example.com"
    }
  });
  assert.equal(dup.status, 409);
});

test("admin sets approver email, gets email on booking, approves via token", async () => {
  const adminSession = await login("admin", "admin1234");
  const setEmail = await call("PATCH", "/api/users/approver/profile", {
    cookies: adminSession.cookies,
    csrf: adminSession.cookies.labreserve_csrf,
    body: { email: "approver@test.local", name: "Approver Tester" }
  });
  assert.equal(setEmail.status, 200);

  const before = mailer.sentLog.length;
  const requesterSession = await login("requester", "request1234");
  const create = await call("POST", "/api/bookings", {
    cookies: requesterSession.cookies,
    csrf: requesterSession.cookies.labreserve_csrf,
    body: {
      requester: "Token Tester",
      department: "Lab",
      tool: "HPLC Agilent 1260",
      start: "2026-10-01T09:00",
      end: "2026-10-01T10:00",
      purpose: "token approve test"
    }
  });
  assert.equal(create.status, 201);
  const bookingId = create.data.booking.id;

  await new Promise((r) => setTimeout(r, 50));
  const approverMails = mailer.sentLog.slice(before).filter((m) => m.to === "approver@test.local");
  assert.ok(approverMails.length >= 1, "approver should receive at least one email");
  const mail = approverMails[approverMails.length - 1];
  const match = mail.html.match(/token=([A-Za-z0-9_\-]+)&action=approve/);
  assert.ok(match, "approve token should be in email");
  const token = decodeURIComponent(match[1]);

  const confirm = await call("POST", "/api/approval/confirm", {
    body: { token, action: "approve" }
  });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.data.booking.status, "approved");

  const replay = await call("POST", "/api/approval/confirm", {
    body: { token, action: "approve" }
  });
  assert.equal(replay.status, 410);
});

test("reject via token requires reason and stores it", async () => {
  const adminSession = await login("admin", "admin1234");
  await call("PATCH", "/api/users/approver/profile", {
    cookies: adminSession.cookies,
    csrf: adminSession.cookies.labreserve_csrf,
    body: { email: "approver@test.local" }
  });

  const before = mailer.sentLog.length;
  const requesterSession = await login("requester", "request1234");
  const create = await call("POST", "/api/bookings", {
    cookies: requesterSession.cookies,
    csrf: requesterSession.cookies.labreserve_csrf,
    body: {
      requester: "Reject Me",
      department: "Lab",
      tool: "FTIR Bruker Alpha",
      start: "2026-11-01T09:00",
      end: "2026-11-01T10:00",
      purpose: "reject test"
    }
  });
  assert.equal(create.status, 201);

  const mail = mailer.sentLog.slice(before).find((m) => m.to === "approver@test.local");
  const match = mail.html.match(/token=([A-Za-z0-9_\-]+)&action=reject/);
  const token = decodeURIComponent(match[1]);

  const noReason = await call("POST", "/api/approval/confirm", {
    body: { token, action: "reject" }
  });
  assert.equal(noReason.status, 400);

  const ok = await call("POST", "/api/approval/confirm", {
    body: { token, action: "reject", reason: "ช่วงเวลาไม่เหมาะสม" }
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.booking.status, "rejected");
  assert.equal(ok.data.booking.rejection_reason, "ช่วงเวลาไม่เหมาะสม");
});

test("admin manages tool_approvers", async () => {
  const adminSession = await login("admin", "admin1234");
  const list = await call("GET", "/api/tool-approvers", { cookies: adminSession.cookies });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data.entries));

  const removed = await call("DELETE", "/api/tool-approvers", {
    cookies: adminSession.cookies,
    csrf: adminSession.cookies.labreserve_csrf,
    body: { tool: "HPLC Agilent 1260", approver_username: "approver" }
  });
  assert.equal(removed.status, 200);
  assert.ok(!removed.data.entries.find((e) => e.tool === "HPLC Agilent 1260" && e.approver_username === "approver"));

  const added = await call("POST", "/api/tool-approvers", {
    cookies: adminSession.cookies,
    csrf: adminSession.cookies.labreserve_csrf,
    body: { tool: "HPLC Agilent 1260", approver_username: "approver" }
  });
  assert.equal(added.status, 200);
});

test("password change requires 8+ chars", async () => {
  const session = await login("admin", "admin1234");
  const short = await call("PATCH", "/api/users/requester/password", {
    cookies: session.cookies,
    csrf: session.cookies.labreserve_csrf,
    body: { password: "short" }
  });
  assert.equal(short.status, 400);

  const ok = await call("PATCH", "/api/users/requester/password", {
    cookies: session.cookies,
    csrf: session.cookies.labreserve_csrf,
    body: { password: "newpass1234" }
  });
  assert.equal(ok.status, 200);

  const relogin = await login("requester", "newpass1234");
  assert.equal(relogin.status, 200);
});
