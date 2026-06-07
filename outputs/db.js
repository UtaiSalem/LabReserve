const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS tool_approvers (
  tool TEXT NOT NULL,
  approver_username TEXT NOT NULL,
  PRIMARY KEY (tool, approver_username)
);

CREATE TABLE IF NOT EXISTS approval_tokens (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  approver_username TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_tokens_booking ON approval_tokens(booking_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  requester TEXT NOT NULL,
  department TEXT NOT NULL,
  tool TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  staffStatus TEXT NOT NULL DEFAULT 'waiting',
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_tool_start ON bookings(tool, start);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  audience TEXT,
  recipient_user TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  time TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  related_type TEXT,
  related_id TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL,
  username TEXT NOT NULL,
  read_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (notification_id, username)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  actor TEXT,
  role TEXT,
  ip TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
`;

const DEFAULT_USERS = [
  ["admin", "admin1234", "admin", "ผู้ดูแลระบบ", "admin@labreserve.local"],
  ["approver", "approve1234", "approver", "ผู้มีสิทธิอนุมัติ", "approver@labreserve.local"],
  ["staff", "staff1234", "staff", "เจ้าหน้าที่เครื่องมือ", "staff@labreserve.local"],
  ["requester", "request1234", "requester", "ผู้จอง", "requester@labreserve.local"]
];

const DEFAULT_TOOLS = [
  "HPLC Agilent 1260",
  "GC-MS Shimadzu QP2020",
  "SEM JEOL JSM-IT200",
  "FTIR Bruker Alpha"
];

const DEFAULT_BOOKINGS = [
  {
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
    requester: "คุณภัทร",
    department: "เคมีวิเคราะห์",
    tool: "HPLC Agilent 1260",
    start: "2026-06-07T13:00",
    end: "2026-06-07T16:30",
    purpose: "วิเคราะห์สารมาตรฐานในตัวอย่างน้ำ",
    status: "pending",
    staffStatus: "waiting"
  }
];

const DEFAULT_NOTIFICATIONS = [
  {
    audience: "approver",
    title: "มีคำขอรออนุมัติ",
    message: "HPLC Agilent 1260 มีคำขอใช้งานใหม่ที่ต้องตรวจสอบช่วงเวลาและวัตถุประสงค์",
    time: "เริ่มต้นระบบ"
  },
  {
    audience: "staff",
    title: "เตรียมเครื่องมือ",
    message: "SEM JEOL JSM-IT200 ได้รับอนุมัติแล้ว เจ้าหน้าที่สามารถตรวจสอบความพร้อมก่อนใช้งาน",
    time: "เริ่มต้นระบบ"
  }
];

function migrateNotifications(db) {
  const cols = new Set(db.prepare("PRAGMA table_info(notifications)").all().map((c) => c.name));
  const adds = [
    ["recipient_user", "TEXT"],
    ["category", "TEXT"],
    ["related_type", "TEXT"],
    ["related_id", "TEXT"],
    ["severity", "TEXT NOT NULL DEFAULT 'info'"]
  ];
  for (const [name, decl] of adds) {
    if (!cols.has(name)) db.exec(`ALTER TABLE notifications ADD COLUMN ${name} ${decl}`);
  }
  const audienceInfo = db.prepare("PRAGMA table_info(notifications)").all().find((c) => c.name === "audience");
  if (audienceInfo && audienceInfo.notnull === 1) {
    db.exec(`
      CREATE TABLE notifications_new (
        id TEXT PRIMARY KEY, audience TEXT, recipient_user TEXT,
        title TEXT NOT NULL, message TEXT NOT NULL, time TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0, category TEXT, related_type TEXT,
        related_id TEXT, severity TEXT NOT NULL DEFAULT 'info',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
      INSERT INTO notifications_new SELECT id, audience, recipient_user, title, message, time, read, category, related_type, related_id, severity, created_at FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_new RENAME TO notifications;
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user);
      CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience);
    `);
  }
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrateNotifications(db);
  migrateBookings(db);
  migrateUsers(db);
  return db;
}

function migrateBookings(db) {
  const cols = new Set(db.prepare("PRAGMA table_info(bookings)").all().map((c) => c.name));
  if (!cols.has("created_by")) db.exec("ALTER TABLE bookings ADD COLUMN created_by TEXT");
  if (!cols.has("rejection_reason")) db.exec("ALTER TABLE bookings ADD COLUMN rejection_reason TEXT");
}

function migrateUsers(db) {
  const cols = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
  if (!cols.has("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  if (!cols.has("department")) db.exec("ALTER TABLE users ADD COLUMN department TEXT");
  if (!cols.has("active")) db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
}

function seedIfEmpty(db, jsonPath) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count > 0) return { seeded: false };

  if (jsonPath && fs.existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      importFromJson(db, raw);
      return { seeded: true, source: "json" };
    } catch (error) {
      console.warn("Failed to import JSON, falling back to defaults:", error.message);
    }
  }

  seedDefaults(db);
  return { seeded: true, source: "defaults" };
}

function seedDefaults(db) {
  const insertUser = db.prepare(
    "INSERT INTO users (username, role, name, email, salt, hash) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertBooking = db.prepare(
    "INSERT INTO bookings (id, requester, department, tool, start, end, purpose, status, staffStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertNotification = db.prepare(
    "INSERT INTO notifications (id, audience, title, message, time, read) VALUES (?, ?, ?, ?, ?, 0)"
  );
  const insertToolApprover = db.prepare(
    "INSERT OR IGNORE INTO tool_approvers (tool, approver_username) VALUES (?, ?)"
  );

  const tx = db.transaction(() => {
    for (const [username, password, role, name, email] of DEFAULT_USERS) {
      const { salt, hash } = hashPassword(password);
      insertUser.run(username, role, name, email, salt, hash);
    }
    for (const tool of DEFAULT_TOOLS) {
      insertToolApprover.run(tool, "approver");
    }
    for (const b of DEFAULT_BOOKINGS) {
      insertBooking.run(crypto.randomUUID(), b.requester, b.department, b.tool, b.start, b.end, b.purpose, b.status, b.staffStatus);
    }
    for (const n of DEFAULT_NOTIFICATIONS) {
      insertNotification.run(crypto.randomUUID(), n.audience, n.title, n.message, n.time);
    }
  });
  tx();
}

function importFromJson(db, raw) {
  const insertUser = db.prepare(
    "INSERT INTO users (username, role, name, salt, hash) VALUES (?, ?, ?, ?, ?)"
  );
  const insertBooking = db.prepare(
    "INSERT INTO bookings (id, requester, department, tool, start, end, purpose, status, staffStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertNotification = db.prepare(
    "INSERT INTO notifications (id, audience, title, message, time, read) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    const users = Array.isArray(raw.users) && raw.users.length ? raw.users : null;
    if (users) {
      for (const u of users) {
        insertUser.run(u.username, u.role, u.name, u.salt, u.hash);
      }
    } else {
      for (const [username, password, role, name] of DEFAULT_USERS) {
        const { salt, hash } = hashPassword(password);
        insertUser.run(username, role, name, salt, hash);
      }
    }
    const insertToolApprover = db.prepare("INSERT OR IGNORE INTO tool_approvers (tool, approver_username) VALUES (?, ?)");
    for (const tool of DEFAULT_TOOLS) insertToolApprover.run(tool, "approver");
    const bookings = Array.isArray(raw.bookings) ? raw.bookings : DEFAULT_BOOKINGS;
    for (const b of bookings) {
      insertBooking.run(b.id || crypto.randomUUID(), b.requester, b.department, b.tool, b.start, b.end, b.purpose, b.status || "pending", b.staffStatus || "waiting");
    }
    const notifications = Array.isArray(raw.notifications) ? raw.notifications : DEFAULT_NOTIFICATIONS;
    for (const n of notifications) {
      insertNotification.run(n.id || crypto.randomUUID(), n.audience, n.title, n.message, n.time, n.read ? 1 : 0);
    }
  });
  tx();
}

function publicUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    role: row.role,
    name: row.name,
    email: row.email || null,
    department: row.department || null,
    active: row.active === 0 ? false : true
  };
}

function makeRepo(db) {
  const q = {
    findUser: db.prepare("SELECT * FROM users WHERE username = ?"),
    findUserByEmail: db.prepare("SELECT * FROM users WHERE email = ? AND email IS NOT NULL"),
    listUsers: db.prepare("SELECT username, role, name, email, department, active FROM users ORDER BY username"),
    listUsersByRole: db.prepare("SELECT username, role, name, email, department, active FROM users WHERE role = ? ORDER BY username"),
    insertUser: db.prepare("INSERT INTO users (username, role, name, email, department, salt, hash) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    updatePassword: db.prepare("UPDATE users SET salt = ?, hash = ? WHERE username = ?"),
    updateUserProfile: db.prepare("UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), department = COALESCE(?, department), active = COALESCE(?, active) WHERE username = ?"),

    listToolApprovers: db.prepare(`
      SELECT ta.tool, ta.approver_username, u.name, u.email
      FROM tool_approvers ta JOIN users u ON u.username = ta.approver_username
      ORDER BY ta.tool, u.name
    `),
    approversForTool: db.prepare(`
      SELECT u.username, u.name, u.email
      FROM tool_approvers ta JOIN users u ON u.username = ta.approver_username
      WHERE ta.tool = ? AND u.active = 1
    `),
    addToolApprover: db.prepare("INSERT OR IGNORE INTO tool_approvers (tool, approver_username) VALUES (?, ?)"),
    removeToolApprover: db.prepare("DELETE FROM tool_approvers WHERE tool = ? AND approver_username = ?"),

    insertToken: db.prepare(`
      INSERT INTO approval_tokens (id, booking_id, approver_username, token_hash, action, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    findTokenByHash: db.prepare(`
      SELECT id, booking_id, approver_username, action, expires_at, used_at, used_by
      FROM approval_tokens WHERE token_hash = ?
    `),
    markTokenUsed: db.prepare("UPDATE approval_tokens SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL"),
    invalidateTokensForBooking: db.prepare("UPDATE approval_tokens SET used_at = strftime('%s','now'), used_by = 'system:invalidated' WHERE booking_id = ? AND used_at IS NULL"),

    updateBookingReject: db.prepare("UPDATE bookings SET status = 'rejected', rejection_reason = ? WHERE id = ?"),

    listBookings: db.prepare("SELECT id, requester, department, tool, start, end, purpose, status, staffStatus, created_by, rejection_reason FROM bookings ORDER BY start"),
    findBooking: db.prepare("SELECT id, requester, department, tool, start, end, purpose, status, staffStatus, created_by, rejection_reason FROM bookings WHERE id = ?"),
    insertBooking: db.prepare("INSERT INTO bookings (id, requester, department, tool, start, end, purpose, status, staffStatus, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    updateBookingStatus: db.prepare("UPDATE bookings SET status = ? WHERE id = ?"),
    updateBookingStaff: db.prepare("UPDATE bookings SET staffStatus = ? WHERE id = ?"),
    nonRejectedNotReady: db.prepare("SELECT id, requester, tool FROM bookings WHERE status != 'rejected' AND staffStatus != 'ready'"),
    conflictRow: db.prepare(`
      SELECT id, requester, department, tool, start, end, purpose, status, staffStatus
      FROM bookings
      WHERE tool = ? AND status != 'rejected' AND id != ?
        AND start < ? AND end > ?
      LIMIT 1
    `),

    listNotifications: db.prepare(`
      SELECT n.id, n.audience, n.recipient_user, n.title, n.message, n.time,
             n.category, n.related_type, n.related_id, n.severity, n.created_at,
             CASE WHEN nr.username IS NOT NULL THEN 1 ELSE n.read END AS read
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.username = @username
      WHERE n.recipient_user = @username
         OR (n.recipient_user IS NULL AND (n.audience = @role OR n.audience IS NULL))
      ORDER BY n.created_at DESC
      LIMIT 200
    `),
    findNotification: db.prepare("SELECT id, audience, recipient_user FROM notifications WHERE id = ?"),
    insertNotification: db.prepare(`
      INSERT INTO notifications (id, audience, recipient_user, title, message, time, category, related_type, related_id, severity)
      VALUES (@id, @audience, @recipient_user, @title, @message, @time, @category, @related_type, @related_id, @severity)
    `),
    clearNotifications: db.prepare("DELETE FROM notifications"),
    markRead: db.prepare("INSERT OR IGNORE INTO notification_reads (notification_id, username) VALUES (?, ?)"),
    markAllRead: db.prepare(`
      INSERT OR IGNORE INTO notification_reads (notification_id, username)
      SELECT n.id, @username FROM notifications n
      WHERE n.recipient_user = @username
         OR (n.recipient_user IS NULL AND (n.audience = @role OR n.audience IS NULL))
    `),
    unreadCount: db.prepare(`
      SELECT COUNT(*) AS n FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.username = @username
      WHERE nr.username IS NULL
        AND (n.recipient_user = @username
             OR (n.recipient_user IS NULL AND (n.audience = @role OR n.audience IS NULL)))
    `),
    countLoginFailures: db.prepare(`
      SELECT COUNT(*) AS n FROM audit_log
      WHERE action = 'login.failed' AND ip = ? AND ts > ?
    `),

    insertAudit: db.prepare("INSERT INTO audit_log (ts, actor, role, ip, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    listAudit: db.prepare("SELECT ts, actor, role, ip, action, target_type, target_id, details FROM audit_log ORDER BY ts DESC LIMIT ?")
  };

  return {
    raw: db,

    findUser(username) {
      return q.findUser.get(username);
    },
    findUserByEmail(email) {
      return q.findUserByEmail.get(email);
    },
    listUsers() {
      return q.listUsers.all().map(publicUser);
    },
    listUsersByRole(role) {
      return q.listUsersByRole.all(role).map(publicUser);
    },
    createUser({ username, password, role, name, email, department }) {
      const { salt, hash } = hashPassword(password);
      q.insertUser.run(username, role, name, email || null, department || null, salt, hash);
    },
    updateUserProfile(username, { name, email, department, active }) {
      q.updateUserProfile.run(
        name ?? null,
        email ?? null,
        department ?? null,
        active === undefined ? null : (active ? 1 : 0),
        username
      );
    },
    setPassword(username, password) {
      const { salt, hash } = hashPassword(password);
      q.updatePassword.run(salt, hash, username);
    },

    listToolApprovers() {
      return q.listToolApprovers.all();
    },
    approversForTool(tool) {
      return q.approversForTool.all(tool);
    },
    addToolApprover(tool, username) {
      q.addToolApprover.run(tool, username);
    },
    removeToolApprover(tool, username) {
      q.removeToolApprover.run(tool, username);
    },

    insertApprovalToken(token) {
      q.insertToken.run(token.id, token.booking_id, token.approver_username, token.token_hash, token.action, token.expires_at);
    },
    findApprovalTokenByHash(hash) {
      return q.findTokenByHash.get(hash);
    },
    markApprovalTokenUsed(id, usedBy) {
      const info = q.markTokenUsed.run(Math.floor(Date.now() / 1000), usedBy, id);
      return info.changes > 0;
    },
    invalidateTokensForBooking(bookingId) {
      q.invalidateTokensForBooking.run(bookingId);
    },
    rejectBooking(id, reason) {
      q.updateBookingReject.run(reason || null, id);
    },

    listBookings() {
      return q.listBookings.all().map((b) => ({ ...b }));
    },
    findBooking(id) {
      const row = q.findBooking.get(id);
      return row ? { ...row } : null;
    },
    insertBooking(b) {
      q.insertBooking.run(b.id, b.requester, b.department, b.tool, b.start, b.end, b.purpose, b.status, b.staffStatus, b.created_by || null);
    },
    updateBookingStatus(id, status) {
      q.updateBookingStatus.run(status, id);
    },
    updateBookingStaff(id, staffStatus) {
      q.updateBookingStaff.run(staffStatus, id);
    },
    nonReadyBookings() {
      return q.nonRejectedNotReady.all();
    },
    findConflict(booking, ignoreId = "") {
      const row = q.conflictRow.get(booking.tool, ignoreId, booking.end, booking.start);
      return row || null;
    },

    listNotifications({ username, role }) {
      return q.listNotifications.all({ username, role }).map((n) => ({ ...n, read: !!n.read }));
    },
    addNotification(n) {
      q.insertNotification.run({
        id: n.id,
        audience: n.audience || null,
        recipient_user: n.recipient_user || null,
        title: n.title,
        message: n.message,
        time: n.time,
        category: n.category || null,
        related_type: n.related_type || null,
        related_id: n.related_id || null,
        severity: n.severity || "info"
      });
    },
    findNotificationMeta(id) {
      return q.findNotification.get(id);
    },
    clearNotifications() {
      q.clearNotifications.run();
    },
    markRead(notificationId, username) {
      q.markRead.run(notificationId, username);
    },
    markAllRead({ username, role }) {
      q.markAllRead.run({ username, role });
    },
    unreadCount({ username, role }) {
      return q.unreadCount.get({ username, role }).n;
    },
    recentLoginFailures(ip, sinceMs) {
      return q.countLoginFailures.get(ip, Math.floor(sinceMs / 1000)).n;
    },

    audit(entry) {
      q.insertAudit.run(
        entry.ts || Date.now(),
        entry.actor || null,
        entry.role || null,
        entry.ip || null,
        entry.action,
        entry.target_type || null,
        entry.target_id || null,
        entry.details ? JSON.stringify(entry.details) : null
      );
    },
    listAudit(limit = 200) {
      return q.listAudit.all(limit).map((row) => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
      }));
    },

    publicUser
  };
}

function initRepo({ dbPath, jsonPath }) {
  const db = openDb(dbPath);
  const status = seedIfEmpty(db, jsonPath);
  return { repo: makeRepo(db), status };
}

module.exports = {
  openDb,
  seedIfEmpty,
  makeRepo,
  initRepo,
  hashPassword,
  verifyPassword,
  publicUser
};
