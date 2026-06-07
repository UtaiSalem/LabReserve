# LabReserve Deployment

LabReserve is a Node.js web app with a JSON data file. For online use, run it behind HTTPS and mount a persistent data directory.

## Local Production Run

```powershell
cd C:\Users\User\Documents\Codex\2026-06-04\new-chat\outputs
C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe server.js
```

Open:

```text
http://localhost:8775/scientific-instrument-booking.html
```

## Docker

Build:

```bash
docker build -t labreserve .
```

Run with persistent data:

```bash
docker run -d \
  --name labreserve \
  -p 8775:8775 \
  -v labreserve-data:/data \
  labreserve
```

Open:

```text
http://SERVER_IP:8775/scientific-instrument-booking.html
```

## Production Checklist

- Put the app behind HTTPS using Nginx, Caddy, Traefik, or a cloud load balancer.
- Mount `/data` as persistent storage so `labreserve-db.json` survives restarts.
- Back up `/data/labreserve-db.json` every day.
- Login is enabled. Change the default passwords before public release.
- For a multi-user organization, migrate from JSON storage to PostgreSQL or SQLite with transaction locking.
- Configure real Email, LINE, or Microsoft Teams integrations after user accounts are finalized.

## Default Test Accounts

Change these before using the system publicly. Log in as `admin`, open the back-office/user management panel, and set new passwords.

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
