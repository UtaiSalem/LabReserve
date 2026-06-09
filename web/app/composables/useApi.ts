/**
 * Wrapper รอบ $fetch ที่:
 * - ใช้ฐาน /api ของ Nuxt (proxy ไป legacy backend port 8775)
 * - แนบ header x-csrf-token อัตโนมัติสำหรับ POST/PATCH/PUT/DELETE
 * - ส่ง cookies ในทุก request (same-origin, default)
 */

function readCookie(name: string): string | null {
  if (import.meta.server) return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]!) : null
}

export function useApi() {
  const csrfMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

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
    }
  })

  return api
}
