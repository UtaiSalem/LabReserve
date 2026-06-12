# LabReserve — ระบบจองเครื่องมือวิทยาศาสตร์

ระบบจองและอนุมัติการใช้เครื่องมือวิทยาศาสตร์ ประกอบด้วย 2 ส่วน:

| ส่วน | โฟลเดอร์ | เทคโนโลยี | Deploy ที่ |
| --- | --- | --- | --- |
| Frontend | [`web/`](web) | Nuxt 4 + Nuxt UI | Netlify |
| Backend (API) | [`outputs/`](outputs) | Node.js + better-sqlite3 | Render / Railway / เครื่องในองค์กร |

Frontend ไม่เรียก backend ตรงๆ จากเบราว์เซอร์ แต่ proxy ทุก request ผ่าน
[`web/server/api/[...path].ts`](web/server/api/%5B...path%5D.ts) ทำให้ cookie/session
เป็น same-origin เสมอ ไม่ต้องตั้งค่า CORS ฝั่งเบราว์เซอร์

## รันบนเครื่อง (Development)

ต้องมี Node.js >= 20 และ pnpm

```powershell
# 1) Backend (เทอร์มินัลที่ 1) — รันที่พอร์ต 8775
cd outputs
npm install
node server.js

# 2) Frontend (เทอร์มินัลที่ 2)
cd web
pnpm install
pnpm dev
```

เปิด http://localhost:3000 — frontend จะ proxy `/api/*` ไปที่ `http://localhost:8775` ให้อัตโนมัติ

## Deploy Production

### ขั้นที่ 1: Deploy backend ก่อน

Backend ต้องรันเป็น server ถาวรและมีดิสก์ถาวรสำหรับไฟล์ SQLite —
**ห้ามรันบน Netlify** ดูรายละเอียดทุกทางเลือก (เครื่องในองค์กร, Docker, Render,
Railway) ได้ที่ [outputs/DEPLOYMENT.md](outputs/DEPLOYMENT.md)

ตัวแปรแวดล้อมขั้นต่ำที่ต้องตั้ง:

| ตัวแปร | ค่า |
| --- | --- |
| `SESSION_SECRET` | สุ่ม 64 hex (`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`) |
| `DATA_DIR` | โฟลเดอร์บนดิสก์ถาวร เช่น `/data` |
| `APP_ORIGIN` | URL ของ frontend บน Netlify เช่น `https://labreserve.netlify.app` |
| `SECURE_COOKIES` | `true` |

### ขั้นที่ 2: เชื่อม Netlify กับ repo นี้

1. Netlify → **Add new site → Import an existing project** → เลือก repo นี้
   ([netlify.toml](netlify.toml) ตั้ง base directory เป็น `web/` ให้แล้ว ไม่ต้องกรอกอะไรเพิ่ม)
2. ตั้ง environment variable ใน **Site settings → Environment variables**:

   ```
   NUXT_LEGACY_API_BASE = https://<backend-url-จากขั้นที่-1>
   ```

3. Deploy — ทุกครั้งที่ push ขึ้น branch `main` Netlify จะ build และ deploy ให้อัตโนมัติ

### ขั้นที่ 3: ตรวจหลัง deploy

- เปิดเว็บบน Netlify แล้วลอง login — ถ้า login ไม่ผ่าน ให้เช็คว่า
  `NUXT_LEGACY_API_BASE` ชี้ถูกและ backend ตั้ง `APP_ORIGIN`/`SECURE_COOKIES` แล้ว
- ถ้าใช้ระบบอีเมลอนุมัติ ตั้ง `APP_URL` ฝั่ง backend เป็น URL ของ backend เอง
  เพื่อให้ลิงก์ในอีเมลใช้งานได้

## โครงสร้าง repo

```
LabReserve/
  web/        # Nuxt frontend (deploy บน Netlify)
  outputs/    # Node backend + SQLite (deploy แยก) — มี index.html เป็น UI รุ่นเก่า
  netlify.toml
```

หมายเหตุ: `outputs/index.html` และ `scientific-instrument-booking.html`
เป็น frontend รุ่นเก่าที่ backend เสิร์ฟเองได้ ใช้เป็น fallback ได้
แต่เส้นทางหลักคือ Nuxt ใน `web/`
