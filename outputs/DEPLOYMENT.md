# LabReserve Deployment

LabReserve is a zero-dependency Node.js app with a JSON data file. It can be deployed without adding paid services if you run it on an existing computer/server, or on a cloud plan that is explicitly Always Free. The safest no-cost path is an existing lab PC/server plus HTTPS in front of it.

## Production Settings

Set these environment variables before public use:

| Variable | Example | Required | Purpose |
| --- | --- | --- | --- |
| `PORT` | `8775` | No | HTTP port for the Node server |
| `HOST` | `0.0.0.0` | No | Bind address |
| `DATA_DIR` | `/data` | Yes | Persistent folder for `labreserve-db.json` |
| `SESSION_SECRET` | random 64 hex chars | Yes | Signs login cookies and keeps sessions valid after restart |
| `APP_ORIGIN` | `https://labreserve.example.com` | Yes when public | Allows the public HTTPS origin |
| `SECURE_COOKIES` | `true` | Yes behind HTTPS | Adds the `Secure` flag to login cookies |

Generate a session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Option A: Existing Windows PC or Server

This has no hosting fee if the organization already owns the machine.

```powershell
cd C:\Users\Administrator\Documents\LabReserve\outputs
$env:NODE_ENV = "production"
$env:PORT = "8775"
$env:HOST = "0.0.0.0"
$env:DATA_DIR = "C:\LabReserve\data"
$env:SESSION_SECRET = "replace-with-generated-secret"
$env:APP_ORIGIN = "https://labreserve.example.com"
$env:SECURE_COOKIES = "true"
node server.js
```

Open locally:

```text
http://localhost:8775/
```

For public use, place HTTPS in front of the app with one of these no-extra-cost approaches:

- Existing reverse proxy already used by the organization, such as Nginx, Caddy, IIS ARR, or Traefik.
- Cloudflare Tunnel on a domain the organization already owns. It avoids opening inbound firewall ports and provides HTTPS at the public hostname.

## Option B: Docker on an Existing Server

Build:

```bash
docker build -t labreserve .
```

Run with persistent data:

```bash
docker run -d \
  --name labreserve \
  -p 8775:8775 \
  -e NODE_ENV=production \
  -e DATA_DIR=/data \
  -e SESSION_SECRET=replace-with-generated-secret \
  -e APP_ORIGIN=https://labreserve.example.com \
  -e SECURE_COOKIES=true \
  -v labreserve-data:/data \
  labreserve
```

Open:

```text
http://SERVER_IP:8775/
```

## Option C: Always Free VM

Oracle Cloud Infrastructure has Always Free compute resources. If you choose this path, create only resources marked Always Free-eligible, mount persistent storage, and set a spending limit/budget alert in the cloud console. Do not add paid load balancers, paid disks, or paid managed databases unless the organization approves a cost.

Recommended VM setup:

```bash
sudo apt update
sudo apt install -y nodejs npm
mkdir -p /opt/labreserve /var/lib/labreserve
cp -r outputs/* /opt/labreserve/
cd /opt/labreserve
NODE_ENV=production \
PORT=8775 \
HOST=0.0.0.0 \
DATA_DIR=/var/lib/labreserve \
SESSION_SECRET=replace-with-generated-secret \
APP_ORIGIN=https://your-free-or-existing-hostname.example \
SECURE_COOKIES=true \
node server.js
```

Use HTTPS before opening the service to real users.

## Avoid for Real Data

Free app platforms with ephemeral filesystems are fine for demos, but not for this app's production data unless you also add durable storage. In particular, do not rely on a free web service whose local files are deleted on restart, redeploy, or idle spin-down.

## Production Checklist

- Change every default password before public release.
- Set `SESSION_SECRET`, `DATA_DIR`, `APP_ORIGIN`, and `SECURE_COOKIES=true`.
- Run behind HTTPS.
- Keep `labreserve-db.json` in a persistent folder or volume.
- Back up `labreserve-db.json` every day.
- Restrict OS/server access to administrators only.
- Test login, booking creation, approval, staff status updates, and logout after deployment.
- For heavy concurrent usage, migrate JSON storage to SQLite or PostgreSQL later.

## Default Test Accounts

Change these before using the system publicly. Log in as `admin`, open the user management panel, and set new passwords.

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin1234` | Admin |
| `approver` | `approve1234` | Approver |
| `staff` | `staff1234` | Staff |
| `requester` | `request1234` | Requester |

## Health Check

```text
GET /health
```

Expected response:

```json
{ "ok": true, "service": "LabReserve" }
```
