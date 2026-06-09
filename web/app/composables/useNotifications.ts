import type { Notification } from '~/types/booking'

export function useNotifications() {
  const { data, refresh } = useSnapshot()
  const { role } = useAuth()
  const api = useApi()

  const list = computed<Notification[]>(() => data.value?.notifications || [])
  const unreadCount = computed(() => data.value?.unreadCount || 0)

  async function markRead(id: string) {
    const n = list.value.find(x => x.id === id)
    if (!n || n.read) return

    // Optimistic update
    n.read = true
    if (data.value) data.value.unreadCount = Math.max(0, data.value.unreadCount - 1)

    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' })
    } catch {
      n.read = false
      if (data.value) data.value.unreadCount++
    }
  }

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'POST' })
      await refresh()
    } catch (e) {
      console.error('Failed to mark all read', e)
    }
  }

  /**
   * Deep-link notification → page ที่ต้อง action จริง
   * เป้าหมาย: กดแล้วเจอ item ทันที ไม่ต้องค้นเอง
   */
  function getLink(n: Notification): string {
    const id = n.related_id
    const cat = n.category || ''

    // booking lifecycle — แต่ละ role มีหน้า own ของตัวเอง
    if (cat.startsWith('booking.')) {
      // requester → ตัวรายละเอียดในคำขอตัวเอง
      if (role.value === 'requester' && id) {
        return `/requester/bookings/${id}`
      }
      // approver → inbox detail (mobile = per-id page, desktop = selected query)
      if (role.value === 'approver' || role.value === 'admin') {
        if (id) {
          // mobile route ใช้งานได้ทั้งสอง breakpoint; query param ก็ใช้ได้
          return `/approver?selected=${id}`
        }
        return '/approver'
      }
      // staff → queue พร้อม focus id (queue page ใช้ ?focus เพื่อ highlight)
      if (role.value === 'staff') {
        return id ? `/staff?focus=${id}` : '/staff'
      }
      return id ? `/requester/bookings/${id}` : '/requester/bookings'
    }

    if (cat === 'staff.remind') return '/staff'
    if (cat === 'security.login_failed') return '/admin/users'
    if (cat === 'user.password_changed') return '/profile'

    return ''
  }

  return {
    list,
    unreadCount,
    markRead,
    markAllRead,
    getLink
  }
}
