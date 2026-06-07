const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 8775);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DB_FILE = path.join(DATA_DIR, "labreserve-db.json");
const SESSION_COOKIE = "labreserve_session";
const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}

function makeUser(username, password, role, name) {
  return { username, role, name, ...hashPassword(password) };
}

const toolConfig = {
  "HPLC Agilent 1260": {
    approver: "รองคณบดีฝ่ายวิจัย",
    staff: "เจ้าหน้าที่เคมีวิเคราะห์",
    channels: ["email", "line", "teams"]
  },
  "GC-MS Shimadzu QP2020": {
    approver: "หัวหน้าศูนย์เครื่องมือ",
    staff: "เจ้าหน้าที่มวลสาร",
    channels: ["email", "teams"]
  },
  "SEM JEOL JSM-IT200": {
    approver: "ผู้จัดการห้องปฏิบัติการวัสดุ",
    staff: "เจ้าหน้าที่กล้องจุลทรรศน์",
    channels: ["email", "line"]
  },
  "FTIR Bruker Alpha": {
    approver: "หัวหน้าห้องสเปกโทรสโกปี",
    staff: "เจ้าหน้าที่สเปกโทรสโกปี",
    channels: ["email", "line", "teams"]
  }
};

const channelLabels = {
  email: "Email",
  line: "LINE",
  teams: "Microsoft Teams"
};

function defaultData() {
  return {
    tools: Object.keys(toolConfig),
    users: [
      makeUser("admin", "admin1234", "admin", "ผู้ดูแลระบบ"),
      makeUser("approver", "approve1234", "approver", "ผู้มีสิทธิอนุมัติ"),
      makeUser("staff", "staff1234", "staff", "เจ้าหน้าที่เครื่องมือ"),
      makeUser("requester", "request1234", "requester", "ผู้จอง")
    ],
    bookings: [
      {
        id: crypto.randomUUID(),
        requester: "ดร.กานต์",
        department: "วัสดุศาสตร์",
        tool: "SEM JEOL JSM-IT200",
        start: "2026-06-06T09:00",
        end: "2026-06-06T12:00",
        purpose: "ตรวจภาพพื้นผิวตัวอย่างโพลิเมอร์",
        status: "approved",
        staffStatus: "ready"
      },
      {
        id: crypto.randomUUID(),
        requester: "คุณภัทร",
        department: "เคมีวิเคราะห์",
        tool: "HPLC Agilent 1260",
        start: "2026-06-07T13:00",
        end: "2026-06-07T16:30",
        purpose: "วิเคราะห์สารมาตรฐานในตัวอย่างน้ำ",
        status: "pending",
        staffStatus: "waiting"
      }
    ],
    notifications: [
      {
        id: crypto.randomUUID(),
        audience: "approver",
        title: "มีคำขอรออนุมัติ",
        message: "HPLC Agilent 1260 มีคำขอใช้งานใหม่ที่ต้องตรวจสอบช่วงเวลาและวัตถุประสงค์",
        time: "เริ่มต้นระบบ",
        read: false
      },
      {
        id: crypto.randomUUID(),
        audience: "staff",
        title: "เตรียมเครื่องมือ",
        message: "SEM JEOL JSM-IT200 ได้รับอนุมัติแล้ว เจ้าหน้าที่สามารถตรวจสอบความพร้อมก่อนใช้งาน",
        time: "เริ่มต้นระบบ",
        read: false
      }
    ]
  };
}

function ensureData(data) {
  const defaults = defaultData();
  data.tools ||= defaults.tools;
  data.bookings ||= defaults.bookings;
  data.notifications ||= defaults.notifications;
  if (!Array.isArray(data.users) || !data.users.length) data.users = defaults.users;
  return data;
}

async function readDb() {
  try {
    const data = ensureData(JSON.parse(await fs.readFile(DB_FILE, "utf8")));
    await writeDb(data);
    return data;
  } catch {
    const data = defaultData();
    await writeDb(data);
    return data;
  }
}

async function writeDb(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function json(res, status, payload) {
  const origin = res.req?.headers.origin;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

function publicUser(user) {
  if (!user) return null;
  return { username: user.username, role: user.role, name: user.name };
}

function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  return token ? sessions.get(token) : null;
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
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findConflict(data, booking, ignoreId = null) {
  const start = new Date(booking.start);
  const end = new Date(booking.end);
  return data.bookings.find((item) => {
    if (item.id === ignoreId || item.tool !== booking.tool || item.status === "rejected") return false;
    return overlaps(start, end, new Date(item.start), new Date(item.end));
  });
}

function channelSummary(tool) {
  return (toolConfig[tool]?.channels || ["email"]).map((channel) => channelLabels[channel]).join(", ");
}

function addNotification(data, audience, tool, title, message) {
  const config = toolConfig[tool] || {};
  const recipient = audience === "staff" ? config.staff : config.approver;
  data.notifications.unshift({
    id: crypto.randomUUID(),
    audience,
    title,
    message: `${message} · ส่งถึง ${recipient || audience} ผ่าน ${channelSummary(tool)}`,
    time: new Date().toLocaleString("th-TH"),
    read: false
  });
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

async function api(req, res, url) {
  const data = await readDb();

  if (req.method === "POST" && url.pathname === "/api/login") {
    const { username, password } = await bodyJson(req);
    const user = data.users.find((item) => item.username === username);
    if (!user || !password || !verifyPassword(password, user)) {
      return json(res, 401, { error: "invalid username or password" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, publicUser(user));
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    return json(res, 200, { user: publicUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    return json(res, 200, { user: currentUser(req) || null });
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const user = requireUser(req, res);
    if (!user) return;
    return json(res, 200, { ...data, toolConfig });
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    return json(res, 200, { users: data.users.map(publicUser) });
  }

  const passwordMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/password$/);
  if (req.method === "PATCH" && passwordMatch) {
    const user = requireRole(req, res, ["admin"]);
    if (!user) return;
    const username = decodeURIComponent(passwordMatch[1]);
    const target = data.users.find((item) => item.username === username);
    if (!target) return json(res, 404, { error: "user not found" });
    const { password } = await bodyJson(req);
    if (!password || password.length < 8) return json(res, 400, { error: "password must be at least 8 characters" });
    const next = hashPassword(password);
    target.salt = next.salt;
    target.hash = next.hash;
    await writeDb(data);
    return json(res, 200, { user: publicUser(target), users: data.users.map(publicUser) });
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
      staffStatus: "waiting"
    };
    const conflict = findConflict(data, booking);
    if (conflict) return json(res, 409, { error: "conflict", conflict });

    data.bookings.push(booking);
    addNotification(data, "approver", booking.tool, "มีคำขอจองใหม่", `${booking.requester} ขอใช้ ${booking.tool}`);
    addNotification(data, "staff", booking.tool, "แจ้งเจ้าหน้าที่ล่วงหน้า", `${booking.tool} มีคำขอใหม่ที่รออนุมัติ`);
    await writeDb(data);
    return json(res, 201, { booking, data });
  }

  const statusMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const user = requireRole(req, res, ["admin", "approver"]);
    if (!user) return;
    const { status } = await bodyJson(req);
    if (!["approved", "rejected"].includes(status)) return json(res, 400, { error: "invalid status" });
    const booking = data.bookings.find((item) => item.id === statusMatch[1]);
    if (!booking) return json(res, 404, { error: "not found" });

    if (status === "approved") {
      const conflict = findConflict(data, booking, booking.id);
      if (conflict) return json(res, 409, { error: "conflict", conflict });
      addNotification(data, "staff", booking.tool, "คำขอได้รับอนุมัติ", `${booking.tool} ของ ${booking.requester} ผ่านการอนุมัติแล้ว`);
    } else {
      addNotification(data, "approver", booking.tool, "บันทึกผลไม่อนุมัติแล้ว", `${booking.tool} ของ ${booking.requester} ถูกบันทึกเป็นไม่อนุมัติ`);
    }

    booking.status = status;
    await writeDb(data);
    return json(res, 200, { booking, data });
  }

  const staffMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/staff-status$/);
  if (req.method === "PATCH" && staffMatch) {
    const user = requireRole(req, res, ["admin", "staff"]);
    if (!user) return;
    const { staffStatus } = await bodyJson(req);
    if (!["waiting", "ready", "issue", "calibrate"].includes(staffStatus)) return json(res, 400, { error: "invalid staff status" });
    const booking = data.bookings.find((item) => item.id === staffMatch[1]);
    if (!booking) return json(res, 404, { error: "not found" });
    booking.staffStatus = staffStatus;
    addNotification(data, staffStatus === "issue" ? "approver" : "staff", booking.tool, "อัปเดตสถานะเจ้าหน้าที่", `${booking.tool} ของ ${booking.requester}: ${staffStatus}`);
    await writeDb(data);
    return json(res, 200, { booking, data });
  }

  if (req.method === "POST" && url.pathname === "/api/staff/remind") {
    const user = requireRole(req, res, ["admin", "staff", "approver"]);
    if (!user) return;
    data.bookings
      .filter((booking) => booking.status !== "rejected" && booking.staffStatus !== "ready")
      .forEach((booking) => {
        addNotification(data, "staff", booking.tool, "แจ้งเตือนเจ้าหน้าที่ซ้ำ", `${booking.tool} ของ ${booking.requester} ยังไม่ปิดงาน`);
      });
    await writeDb(data);
    return json(res, 200, { data });
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
    const conflict = findConflict(data, booking);
    if (conflict) return json(res, 409, { error: "conflict", conflict });
    data.bookings.push(booking);
    addNotification(data, "approver", booking.tool, "มีคำขอจองตัวอย่าง", `${booking.tool} มีคำขอรออนุมัติใหม่`);
    await writeDb(data);
    return json(res, 201, { booking, data });
  }

  if (req.method === "DELETE" && url.pathname === "/api/notifications") {
    const user = requireRole(req, res, ["admin", "approver", "staff"]);
    if (!user) return;
    data.notifications = [];
    await writeDb(data);
    return json(res, 200, { data });
  }

  return json(res, 404, { error: "not found" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/scientific-instrument-booking.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
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
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      return res.end();
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "LabReserve" });
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LabReserve running at http://${HOST}:${PORT}/`);
  console.log(`Database file: ${DB_FILE}`);
});
