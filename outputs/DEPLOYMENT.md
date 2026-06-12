# LabReserve Deployment

LabReserve's backend is a Node.js app that stores data in a SQLite file (`labreserve.db`, migrated automatically from the legacy `labreserve-db.json` if present). It can be deployed without adding paid services if you run it on an existing computer/server, or on a cloud plan that is explicitly Always Free. The safest no-cost path is an existing lab PC/server plus HTTPS in front of it.

> Deploying the Nuxt frontend (`web/`) on Netlify? Deploy this backend with any option below, then point Netlify's `NUXT_LEGACY_API_BASE` at it — see the root [README.md](../README.md).

## Production Settings

Set these environment variables before public use:

| Variable | Example | Required | Purpose |
| --- | --- | --- | --- |
| `PORT` | `8775` | No | HTTP port for the Node server |
| `HOST` | `0.0.0.0` | No | Bind address |
| `DATA_DIR` | `/data` | Yes | Persistent folder for `labreserve.db` (SQLite) |
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

## Option D: Render or Railway (Paid Persistent Disk)

These platforms make the backend reachable on a public HTTPS URL with no server administration, which pairs well with the Netlify frontend. The free tiers have ephemeral filesystems — you must attach a persistent disk/volume (paid) or your data is wiped on every deploy and idle spin-down.

Render (Web Service):

1. New → Web Service → connect this repo, set **Root Directory** to `outputs`.
2. Build command: `npm install` — Start command: `node server.js`.
3. Add a **Persistent Disk** (e.g. 1 GB) mounted at `/data`.
4. Environment variables:

```text
NODE_ENV=production
DATA_DIR=/data
SESSION_SECRET=<generated secret>
APP_ORIGIN=https://<your-netlify-site>.netlify.app
SECURE_COOKIES=true
```

Railway is the same idea: deploy from the repo with root directory `outputs`, attach a **Volume** mounted at `/data`, and set the same variables.

After the first deploy, verify `https://<backend-url>/health` returns `{ "ok": true }`, then set `NUXT_LEGACY_API_BASE=https://<backend-url>` on the Netlify site.

## Avoid for Real Data

Free app platforms with ephemeral filesystems are fine for demos, but not for this app's production data unless you also add durable storage. In particular, do not rely on a free web service whose local files are deleted on restart, redeploy, or idle spin-down.

## Production Checklist

- Change every default password before public release.
- Set `SESSION_SECRET`, `DATA_DIR`, `APP_ORIGIN`, and `SECURE_COOKIES=true`.
- Run behind HTTPS.
- Keep `labreserve.db` in a persistent folder or volume (`DATA_DIR`).
- Back up `labreserve.db` every day.
- Restrict OS/server access to administrators only.
- Test login, booking creation, approval, staff status updates, and logout after deployment.
- For very heavy concurrent usage, consider migrating from SQLite to PostgreSQL later.

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
