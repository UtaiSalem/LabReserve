# LabReserve Deployment

LabReserve's backend now stores data in PostgreSQL via `DATABASE_URL`. The simplest production-friendly setup is:

- Frontend: Netlify
- Backend: Render or Railway
- Database: Supabase Postgres

## Production Settings

Set these environment variables before public use:

| Variable | Example | Required | Purpose |
| --- | --- | --- | --- |
| `PORT` | `8775` | No | HTTP port for the Node server |
| `HOST` | `0.0.0.0` | No | Bind address |
| `DATABASE_URL` | `postgresql://...` | Yes | PostgreSQL connection string, for example from Supabase |
| `DATABASE_SSL` | `true` | No | Keep `true` for Supabase |
| `SESSION_SECRET` | random 64 hex chars | Yes | Signs login cookies and keeps sessions valid after restart |
| `APP_ORIGIN` | `https://labreserve.example.com` | Yes when public | Frontend origin used for cookies and CORS |
| `ALLOWED_ORIGINS` | `https://labreserve.example.com` | Recommended | Explicit frontend allowlist |
| `SECURE_COOKIES` | `true` | Yes behind HTTPS | Adds the `Secure` flag to login cookies |

Generate a session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Supabase Setup

1. Create a Supabase project.
2. Open the project dashboard and click `Connect`.
3. Copy a Postgres connection string.
4. Put that string into `DATABASE_URL`.

Use the connection mode that matches your backend host:

- Use the direct connection string for a long-lived backend if the host supports IPv6.
- Use the shared pooler session mode connection string if the host is IPv4-only.

Reference:
- [Supabase: Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)

## Local development

The server auto-loads `outputs/.env` on startup if the file exists, so the quickest path is:

```powershell
cd C:\Users\Administrator\Documents\LabReserve\outputs
copy .env.example .env
notepad .env   # fill in DATABASE_URL, SESSION_SECRET, etc.
npm start
```

`.env` is gitignored. For local dev against Supabase, use:

```text
DATABASE_URL=postgresql://postgres.[project-ref]:PASSWORD@aws-[region].pooler.supabase.com:5432/postgres
DATABASE_SSL=true
SESSION_SECRET=<64 hex chars>
APP_ORIGIN=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
SECURE_COOKIES=false
```

## Option A: Existing Windows PC or Server (inline env vars)

If you'd rather not use a `.env` file:

```powershell
cd C:\Users\Administrator\Documents\LabReserve\outputs
$env:NODE_ENV = "production"
$env:PORT = "8775"
$env:HOST = "0.0.0.0"
$env:DATABASE_URL = "postgresql://postgres.[project-ref]:PASSWORD@aws-[region].pooler.supabase.com:5432/postgres"
$env:DATABASE_SSL = "true"
$env:SESSION_SECRET = "replace-with-generated-secret"
$env:APP_ORIGIN = "https://labreserve.example.com"
$env:ALLOWED_ORIGINS = "https://labreserve.example.com"
$env:SECURE_COOKIES = "true"
node server.js
```

## Option B: Docker on an Existing Server

```bash
docker build -t labreserve .
docker run -d \
  --name labreserve \
  -p 8775:8775 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://postgres.[project-ref]:PASSWORD@aws-[region].pooler.supabase.com:5432/postgres \
  -e DATABASE_SSL=true \
  -e SESSION_SECRET=replace-with-generated-secret \
  -e APP_ORIGIN=https://labreserve.example.com \
  -e ALLOWED_ORIGINS=https://labreserve.example.com \
  -e SECURE_COOKIES=true \
  labreserve
```

## Option C: Render or Railway (Step-by-Step)

End-to-end checklist for Supabase + Render backend + Netlify frontend.

### 1. Supabase (database)

1. Create a project at https://supabase.com.
2. Wait for provisioning to finish.
3. Go to `Project Settings` → `Database` → `Connection string`.
4. Choose:
   - `URI` + `Transaction pooler` if Render is IPv4-only (the safe default).
   - `URI` + `Direct connection` if your backend host has IPv6.
5. Copy the string. Replace `[YOUR-PASSWORD]` with your real DB password.
6. Save it — you'll paste it into Render as `DATABASE_URL`.

### 2. Generate `SESSION_SECRET`

On any machine with Node:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-hex output.

### 3. Push this repo to GitHub

If not already pushed:

```bash
git remote add origin https://github.com/<you>/LabReserve.git
git push -u origin main
```

### 4. Render (backend)

1. Sign in at https://render.com → `New +` → `Web Service`.
2. Connect the GitHub repo.
3. Configure:
   - **Name**: `labreserve-api`
   - **Root Directory**: `outputs`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free tier is fine to start.
4. Add environment variables (Advanced → Add Environment Variable):

   ```text
   NODE_ENV=production
   DATABASE_URL=<paste from Supabase>
   DATABASE_SSL=true
   SESSION_SECRET=<paste 64-hex from step 2>
   APP_ORIGIN=<leave blank for now, fill after step 5>
   ALLOWED_ORIGINS=<leave blank for now, fill after step 5>
   SECURE_COOKIES=true
   ```

5. Click `Create Web Service`. Wait ~3–5 min for first deploy.
6. Verify the deploy log shows `LabReserve listening on ...` then test:

   ```text
   GET https://labreserve-api.onrender.com/health
   ```

   Expect:

   ```json
   { "ok": true, "service": "LabReserve" }
   ```

   Copy the Render URL — you'll paste it into Netlify next.

### 5. Netlify (frontend)

1. Sign in at https://netlify.com → `Add new site` → `Import from Git`.
2. Pick the same repo.
3. Configure:
   - **Base directory**: `web`
   - **Build command**: `pnpm install && pnpm build`
   - **Publish directory**: `web/dist`
4. Add environment variables:

   ```text
   NUXT_LEGACY_API_BASE=https://labreserve-api.onrender.com
   ```

   (Use the URL from step 4.6, no trailing slash.)

5. Deploy. Once live, copy the Netlify site URL — for example `https://rsulabreserve.netlify.app`.

### 6. Wire CORS back to Render

Go back to the Render service → `Environment`, fill in the two values you skipped:

```text
APP_ORIGIN=https://rsulabreserve.netlify.app
ALLOWED_ORIGINS=https://rsulabreserve.netlify.app
```

Save → Render redeploys automatically.

### 7. Smoke test

1. Visit the Netlify URL.
2. Log in with a seeded admin user (see notes below) and **change the password immediately**.
3. Make a test booking.
4. Confirm the booking appears in Supabase → `Table Editor`.

### Railway

Same idea: deploy from the repo with root directory `outputs`, paste the same env vars from step 4. Use the Railway-issued URL in the Netlify `NUXT_LEGACY_API_BASE`.

## Notes

- This backend should connect to Supabase through `DATABASE_URL`.
- The Supabase publishable key is not a replacement for the backend database connection.
- The backend creates tables automatically on first boot if the target database is empty.
- Default users are still seeded on the first run of a fresh database. Change those passwords immediately.
