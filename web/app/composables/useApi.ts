/**
 * Wrapper รอบ $fetch ที่:
 * - ใช้ฐาน /api ของ Nuxt (proxy ไป legacy backend port 8775)
 * - แนบ header x-csrf-token อัตโนมัติสำหรับ POST/PATCH/PUT/DELETE
 * - ส่ง cookies ในทุก request (same-origin, default)
 * - แจ้งเตือนเมื่อ backend ใช้เวลาตอบนานผิดปกติ (cold start ของ Render free tier)
 */

const WAKEUP_THRESHOLD_MS = 3000
const WAKEUP_TOAST_ID = 'backend-waking'

let pendingSlowRequests = 0
let wakeupToastShown = false

function readCookie(name: string): string | null {
  if (import.meta.server) return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]!) : null
}

export function useApi() {
  const csrfMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])
  const toast = import.meta.client ? useToast() : null

  function showWakeupToast() {
    if (wakeupToastShown || !toast) return
    wakeupToastShown = true
    toast.add({
      id: WAKEUP_TOAST_ID,
      title: 'เซิร์ฟเวอร์กำลังตื่นจากโหมดประหยัดพลังงาน',
      description: 'ใช้เวลาประมาณ 30 วินาที กรุณารอสักครู่...',
      icon: 'i-lucide-loader-circle',
      color: 'info',
      duration: 0
    })
  }

  function dismissWakeupToast() {
    if (!wakeupToastShown || !toast) return
    if (pendingSlowRequests > 0) return
    wakeupToastShown = false
    toast.remove(WAKEUP_TOAST_ID)
  }

  const api = $fetch.create({
    baseURL: '/api',
    credentials: 'same-origin',
    onRequest({ options }) {
      const method = (options.method || 'GET').toString().toUpperCase()
      if (csrfMethods.has(method)) {
        const token = readCookie('labreserve_csrf')
        if (token) {
          options.headers = new Headers(options.headers || {})
          options.headers.set('x-csrf-token', token)
        }
      }

      if (import.meta.client) {
        const ctx = options as { _wakeupTimer?: ReturnType<typeof setTimeout>, _wakeupCounted?: boolean }
        ctx._wakeupCounted = false
        ctx._wakeupTimer = setTimeout(() => {
          ctx._wakeupCounted = true
          pendingSlowRequests++
          showWakeupToast()
        }, WAKEUP_THRESHOLD_MS)
      }
    },
    onResponse({ options }) {
      const ctx = options as { _wakeupTimer?: ReturnType<typeof setTimeout>, _wakeupCounted?: boolean }
      if (ctx._wakeupTimer) clearTimeout(ctx._wakeupTimer)
      if (ctx._wakeupCounted) {
        pendingSlowRequests = Math.max(0, pendingSlowRequests - 1)
        dismissWakeupToast()
      }
    },
    onResponseError({ options }) {
      const ctx = options as { _wakeupTimer?: ReturnType<typeof setTimeout>, _wakeupCounted?: boolean }
      if (ctx._wakeupTimer) clearTimeout(ctx._wakeupTimer)
      if (ctx._wakeupCounted) {
        pendingSlowRequests = Math.max(0, pendingSlowRequests - 1)
        dismissWakeupToast()
      }
    }
  })

  return api
}
