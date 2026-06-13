const fs = require("node:fs");
const crypto = require("node:crypto");
const pg = require("pg");

const { Pool } = pg;

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
  active BOOLEAN NOT NULL DEFAULT TRUE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
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
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  used_by TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
);
CREATE INDEX IF NOT EXISTS idx_tokens_booking ON approval_tokens(booking_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  requester TEXT NOT NULL,
  department TEXT NOT NULL,
  tool TEXT NOT NULL,
  start TEXT NOT NULL,
  "end" TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "staffStatus" TEXT NOT NULL DEFAULT 'waiting',
  created_by TEXT,
  rejection_reason TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
);
CREATE INDEX IF NOT EXISTS idx_bookings_tool_start ON bookings(tool, start);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  audience TEXT,
  recipient_user TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  time TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  category TEXT,
  related_type TEXT,
  related_id TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL,
  username TEXT NOT NULL,
  read_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
  PRIMARY KEY (notification_id, username)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts BIGINT NOT NULL,
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
  ["admin", "admin1234", "admin", "เธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ", "admin@labreserve.local"],
  ["approver", "approve1234", "approver", "เธเธนเนเธกเธตเธชเธดเธ—เธเธดเธญเธเธธเธกเธฑเธ•เธด", "approver@labreserve.local"],
  ["staff", "staff1234", "staff", "เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเน€เธเธฃเธทเนเธญเธเธกเธทเธญ", "staff@labreserve.local"],
  ["requester", "request1234", "requester", "เธเธนเนเธเธญเธ", "requester@labreserve.local"]
];

const DEFAULT_TOOLS = [
  "HPLC Agilent 1260",
  "GC-MS Shimadzu QP2020",
  "SEM JEOL JSM-IT200",
  "FTIR Bruker Alpha"
];

const DEFAULT_BOOKINGS = [
  {
    requester: "เธ”เธฃ.เธเธฒเธเธ•เน",
    department: "เธงเธฑเธชเธ”เธธเธจเธฒเธชเธ•เธฃเน",
    tool: "SEM JEOL JSM-IT200",
    start: "2026-06-06T09:00",
    end: "2026-06-06T12:00",
    purpose: "เธ•เธฃเธงเธเธ เธฒเธเธเธทเนเธเธเธดเธงเธ•เธฑเธงเธญเธขเนเธฒเธเนเธเธฅเธดเน€เธกเธญเธฃเน",
    status: "approved",
    staffStatus: "ready"
  },
  {
    requester: "เธเธธเธ“เธ เธฑเธ—เธฃ",
    department: "เน€เธเธกเธตเธงเธดเน€เธเธฃเธฒเธฐเธซเน",
    tool: "HPLC Agilent 1260",
    start: "2026-06-07T13:00",
    end: "2026-06-07T16:30",
    purpose: "เธงเธดเน€เธเธฃเธฒเธฐเธซเนเธชเธฒเธฃเธกเธฒเธ•เธฃเธเธฒเธเนเธเธ•เธฑเธงเธญเธขเนเธฒเธเธเนเธณ",
    status: "pending",
    staffStatus: "waiting"
  }
];

const DEFAULT_NOTIFICATIONS = [
  {
    audience: "approver",
    title: "เธกเธตเธเธณเธเธญเธฃเธญเธญเธเธธเธกเธฑเธ•เธด",
    message: "HPLC Agilent 1260 เธกเธตเธเธณเธเธญเนเธเนเธเธฒเธเนเธซเธกเนเธ—เธตเนเธ•เนเธญเธเธ•เธฃเธงเธเธชเธญเธเธเนเธงเธเน€เธงเธฅเธฒเนเธฅเธฐเธงเธฑเธ•เธ–เธธเธเธฃเธฐเธชเธเธเน",
    time: "เน€เธฃเธดเนเธกเธ•เนเธเธฃเธฐเธเธ"
  },
  {
    audience: "staff",
    title: "เน€เธ•เธฃเธตเธขเธกเน€เธเธฃเธทเนเธญเธเธกเธทเธญ",
    message: "SEM JEOL JSM-IT200 เนเธ”เนเธฃเธฑเธเธญเธเธธเธกเธฑเธ•เธดเนเธฅเนเธง เน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเธชเธฒเธกเธฒเธฃเธ–เธ•เธฃเธงเธเธชเธญเธเธเธงเธฒเธกเธเธฃเนเธญเธกเธเนเธญเธเนเธเนเธเธฒเธ",
    time: "เน€เธฃเธดเนเธกเธ•เนเธเธฃเธฐเธเธ"
  }
];

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";
}

function createPool() {
  const connectionString = databaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required for the backend database connection.");
  }

  const disableSsl = process.env.DATABASE_SSL === "false" || process.env.PGSSLMODE === "disable";
  return new Pool({
    connectionString,
    ssl: disableSsl ? false : { rejectUnauthorized: false }
  });
}

async function runSchema(pool) {
  await pool.query(SCHEMA);
}

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function seedIfEmpty(pool, jsonPath) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  if (rows[0]?.n > 0) return { seeded: false };

  if (jsonPath && fs.existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      await importFromJson(pool, raw);
      return { seeded: true, source: "json" };
    } catch (error) {
      console.warn("Failed to import JSON, falling back to defaults:", error.message);
    }
  }

  await seedDefaults(pool);
  return { seeded: true, source: "defaults" };
}

async function seedDefaults(pool) {
  await withTransaction(pool, async (client) => {
    for (const [username, password, role, name, email] of DEFAULT_USERS) {
      const { salt, hash } = hashPassword(password);
      await client.query(
        "INSERT INTO users (username, role, name, email, salt, hash) VALUES ($1, $2, $3, $4, $5, $6)",
        [username, role, name, email, salt, hash]
      );
    }

    for (const tool of DEFAULT_TOOLS) {
      await client.query(
        "INSERT INTO tool_approvers (tool, approver_username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [tool, "approver"]
      );
    }

    for (const booking of DEFAULT_BOOKINGS) {
      await client.query(
        'INSERT INTO bookings (id, requester, department, tool, start, "end", purpose, status, "staffStatus") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [crypto.randomUUID(), booking.requester, booking.department, booking.tool, booking.start, booking.end, booking.purpose, booking.status, booking.staffStatus]
      );
    }

    for (const notification of DEFAULT_NOTIFICATIONS) {
      await client.query(
        "INSERT INTO notifications (id, audience, title, message, time, read) VALUES ($1, $2, $3, $4, $5, FALSE)",
        [crypto.randomUUID(), notification.audience, notification.title, notification.message, notification.time]
      );
    }
  });
}

async function importFromJson(pool, raw) {
  await withTransaction(pool, async (client) => {
    const users = Array.isArray(raw.users) && raw.users.length ? raw.users : null;
    if (users) {
      for (const user of users) {
        await client.query(
          "INSERT INTO users (username, role, name, email, department, active, salt, hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [
            user.username,
            user.role,
            user.name,
            user.email || null,
            user.department || null,
            user.active !== false,
            user.salt,
            user.hash
          ]
        );
      }
    } else {
      for (const [username, password, role, name, email] of DEFAULT_USERS) {
        const { salt, hash } = hashPassword(password);
        await client.query(
          "INSERT INTO users (username, role, name, email, salt, hash) VALUES ($1, $2, $3, $4, $5, $6)",
          [username, role, name, email, salt, hash]
        );
      }
    }

    for (const tool of DEFAULT_TOOLS) {
      await client.query(
        "INSERT INTO tool_approvers (tool, approver_username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [tool, "approver"]
      );
    }

    const bookings = Array.isArray(raw.bookings) ? raw.bookings : DEFAULT_BOOKINGS;
    for (const booking of bookings) {
      await client.query(
        'INSERT INTO bookings (id, requester, department, tool, start, "end", purpose, status, "staffStatus", created_by, rejection_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [
          booking.id || crypto.randomUUID(),
          booking.requester,
          booking.department,
          booking.tool,
          booking.start,
          booking.end,
          booking.purpose,
          booking.status || "pending",
          booking.staffStatus || "waiting",
          booking.created_by || null,
          booking.rejection_reason || null
        ]
      );
    }

    const notifications = Array.isArray(raw.notifications) ? raw.notifications : DEFAULT_NOTIFICATIONS;
    for (const notification of notifications) {
      await client.query(
        "INSERT INTO notifications (id, audience, recipient_user, title, message, time, read, category, related_type, related_id, severity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        [
          notification.id || crypto.randomUUID(),
          notification.audience || null,
          notification.recipient_user || null,
          notification.title,
          notification.message,
          notification.time,
          notification.read === true,
          notification.category || null,
          notification.related_type || null,
          notification.related_id || null,
          notification.severity || "info"
        ]
      );
    }
  });
}

function publicUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    role: row.role,
    name: row.name,
    email: row.email || null,
    department: row.department || null,
    active: row.active !== false
  };
}

function makeRepo(pool) {
  return {
    raw: pool,

    async findUser(username) {
      const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
      return rows[0] || null;
    },
    async findUserByEmail(email) {
      const { rows } = await pool.query("SELECT * FROM users WHERE email = $1 AND email IS NOT NULL", [email]);
      return rows[0] || null;
    },
    async listUsers() {
      const { rows } = await pool.query("SELECT username, role, name, email, department, active FROM users ORDER BY username");
      return rows.map(publicUser);
    },
    async listUsersByRole(role) {
      const { rows } = await pool.query("SELECT username, role, name, email, department, active FROM users WHERE role = $1 ORDER BY username", [role]);
      return rows.map(publicUser);
    },
    async createUser({ username, password, role, name, email, department }) {
      const { salt, hash } = hashPassword(password);
      await pool.query(
        "INSERT INTO users (username, role, name, email, department, salt, hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [username, role, name, email || null, department || null, salt, hash]
      );
    },
    async updateUserProfile(username, { name, email, department, active }) {
      await pool.query(
        "UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), department = COALESCE($3, department), active = COALESCE($4, active) WHERE username = $5",
        [name ?? null, email ?? null, department ?? null, active === undefined ? null : !!active, username]
      );
    },
    async setPassword(username, password) {
      const { salt, hash } = hashPassword(password);
      await pool.query("UPDATE users SET salt = $1, hash = $2 WHERE username = $3", [salt, hash, username]);
    },

    async listToolApprovers() {
      const { rows } = await pool.query(`
        SELECT ta.tool, ta.approver_username, u.name, u.email
        FROM tool_approvers ta JOIN users u ON u.username = ta.approver_username
        ORDER BY ta.tool, u.name
      `);
      return rows;
    },
    async approversForTool(tool) {
      const { rows } = await pool.query(`
        SELECT u.username, u.name, u.email
        FROM tool_approvers ta JOIN users u ON u.username = ta.approver_username
        WHERE ta.tool = $1 AND u.active = TRUE
      `, [tool]);
      return rows;
    },
    async addToolApprover(tool, username) {
      await pool.query(
        "INSERT INTO tool_approvers (tool, approver_username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [tool, username]
      );
    },
    async removeToolApprover(tool, username) {
      await pool.query("DELETE FROM tool_approvers WHERE tool = $1 AND approver_username = $2", [tool, username]);
    },

    async insertApprovalToken(token) {
      await pool.query(
        "INSERT INTO approval_tokens (id, booking_id, approver_username, token_hash, action, expires_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [token.id, token.booking_id, token.approver_username, token.token_hash, token.action, token.expires_at]
      );
    },
    async findApprovalTokenByHash(hash) {
      const { rows } = await pool.query(
        "SELECT id, booking_id, approver_username, action, expires_at, used_at, used_by FROM approval_tokens WHERE token_hash = $1",
        [hash]
      );
      return rows[0] || null;
    },
    async markApprovalTokenUsed(id, usedBy) {
      const result = await pool.query(
        "UPDATE approval_tokens SET used_at = $1, used_by = $2 WHERE id = $3 AND used_at IS NULL",
        [Math.floor(Date.now() / 1000), usedBy, id]
      );
      return result.rowCount > 0;
    },
    async invalidateTokensForBooking(bookingId) {
      await pool.query(
        "UPDATE approval_tokens SET used_at = EXTRACT(EPOCH FROM NOW())::BIGINT, used_by = 'system:invalidated' WHERE booking_id = $1 AND used_at IS NULL",
        [bookingId]
      );
    },
    async rejectBooking(id, reason) {
      await pool.query("UPDATE bookings SET status = 'rejected', rejection_reason = $1 WHERE id = $2", [reason || null, id]);
    },

    async listBookings() {
      const { rows } = await pool.query('SELECT id, requester, department, tool, start, "end", purpose, status, "staffStatus", created_by, rejection_reason FROM bookings ORDER BY start');
      return rows.map(normalizeBooking);
    },
    async findBooking(id) {
      const { rows } = await pool.query('SELECT id, requester, department, tool, start, "end", purpose, status, "staffStatus", created_by, rejection_reason FROM bookings WHERE id = $1', [id]);
      return rows[0] ? normalizeBooking(rows[0]) : null;
    },
    async insertBooking(booking) {
      await pool.query(
        'INSERT INTO bookings (id, requester, department, tool, start, "end", purpose, status, "staffStatus", created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [booking.id, booking.requester, booking.department, booking.tool, booking.start, booking.end, booking.purpose, booking.status, booking.staffStatus, booking.created_by || null]
      );
    },
    async updateBookingStatus(id, status) {
      await pool.query("UPDATE bookings SET status = $1 WHERE id = $2", [status, id]);
    },
    async updateBookingStaff(id, staffStatus) {
      await pool.query('UPDATE bookings SET "staffStatus" = $1 WHERE id = $2', [staffStatus, id]);
    },
    async nonReadyBookings() {
      const { rows } = await pool.query('SELECT id, requester, tool FROM bookings WHERE status != $1 AND "staffStatus" != $2', ["rejected", "ready"]);
      return rows;
    },
    async findConflict(booking, ignoreId = "") {
      const { rows } = await pool.query(`
        SELECT id, requester, department, tool, start, "end", purpose, status, "staffStatus", created_by, rejection_reason
        FROM bookings
        WHERE tool = $1 AND status != 'rejected' AND id != $2
          AND start < $3 AND "end" > $4
        LIMIT 1
      `, [booking.tool, ignoreId, booking.end, booking.start]);
      return rows[0] ? normalizeBooking(rows[0]) : null;
    },

    async listNotifications({ username, role }) {
      const { rows } = await pool.query(`
        SELECT n.id, n.audience, n.recipient_user, n.title, n.message, n.time,
               n.category, n.related_type, n.related_id, n.severity, n.created_at,
               CASE WHEN nr.username IS NOT NULL THEN TRUE ELSE n.read END AS read
        FROM notifications n
        LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.username = $1
        WHERE n.recipient_user = $1
           OR (n.recipient_user IS NULL AND (n.audience = $2 OR n.audience IS NULL))
        ORDER BY n.created_at DESC
        LIMIT 200
      `, [username, role]);
      return rows.map((row) => ({ ...row, read: row.read === true }));
    },
    async findNotificationMeta(id) {
      const { rows } = await pool.query("SELECT id, audience, recipient_user FROM notifications WHERE id = $1", [id]);
      return rows[0] || null;
    },
    async addNotification(notification) {
      await pool.query(
        "INSERT INTO notifications (id, audience, recipient_user, title, message, time, category, related_type, related_id, severity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [
          notification.id,
          notification.audience || null,
          notification.recipient_user || null,
          notification.title,
          notification.message,
          notification.time,
          notification.category || null,
          notification.related_type || null,
          notification.related_id || null,
          notification.severity || "info"
        ]
      );
    },
    async clearNotifications() {
      await pool.query("DELETE FROM notifications");
    },
    async markRead(notificationId, username) {
      await pool.query(
        "INSERT INTO notification_reads (notification_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [notificationId, username]
      );
    },
    async markAllRead({ username, role }) {
      await pool.query(`
        INSERT INTO notification_reads (notification_id, username)
        SELECT n.id, $1 FROM notifications n
        WHERE n.recipient_user = $1
           OR (n.recipient_user IS NULL AND (n.audience = $2 OR n.audience IS NULL))
        ON CONFLICT DO NOTHING
      `, [username, role]);
    },
    async unreadCount({ username, role }) {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS n
        FROM notifications n
        LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.username = $1
        WHERE nr.username IS NULL
          AND (n.recipient_user = $1
               OR (n.recipient_user IS NULL AND (n.audience = $2 OR n.audience IS NULL)))
      `, [username, role]);
      return rows[0]?.n || 0;
    },
    async recentLoginFailures(ip, sinceMs) {
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM audit_log WHERE action = 'login.failed' AND ip = $1 AND ts > $2",
        [ip, sinceMs]
      );
      return rows[0]?.n || 0;
    },

    async audit(entry) {
      await pool.query(
        "INSERT INTO audit_log (ts, actor, role, ip, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          entry.ts || Date.now(),
          entry.actor || null,
          entry.role || null,
          entry.ip || null,
          entry.action,
          entry.target_type || null,
          entry.target_id || null,
          entry.details ? JSON.stringify(entry.details) : null
        ]
      );
    },
    async listAudit(limit = 200) {
      const { rows } = await pool.query(
        "SELECT ts, actor, role, ip, action, target_type, target_id, details FROM audit_log ORDER BY ts DESC LIMIT $1",
        [limit]
      );
      return rows.map((row) => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
      }));
    },

    publicUser
  };
}

function normalizeBooking(row) {
  return {
    ...row,
    end: row.end,
    staffStatus: row.staffStatus
  };
}

async function initRepo({ jsonPath }) {
  const pool = createPool();
  await runSchema(pool);
  const status = await seedIfEmpty(pool, jsonPath);
  return { repo: makeRepo(pool), status };
}

module.exports = {
  seedIfEmpty,
  makeRepo,
  initRepo,
  hashPassword,
  verifyPassword,
  publicUser
};
