import type { UserRole } from '~/composables/useAuth'

export interface NavItem {
  label: string
  to: string
  icon: string
}

const NAV: Record<UserRole, NavItem[]> = {
  requester: [
    { label: 'หน้าหลัก', to: '/requester', icon: 'i-lucide-home' },
    { label: 'จองเครื่องมือ', to: '/requester/bookings/new', icon: 'i-lucide-plus-circle' },
    { label: 'คำขอของฉัน', to: '/requester/bookings', icon: 'i-lucide-clipboard-list' }
  ],
  approver: [
    { label: 'กล่องอนุมัติ', to: '/approver', icon: 'i-lucide-inbox' },
    { label: 'ประวัติอนุมัติ', to: '/approver/history', icon: 'i-lucide-history' }
  ],
  staff: [
    { label: 'คิววันนี้', to: '/staff', icon: 'i-lucide-list-checks' },
    { label: 'สถานะเครื่องมือ', to: '/staff/instruments', icon: 'i-lucide-flask-conical' }
  ],
  admin: [
    { label: 'ผู้ใช้', to: '/admin/users', icon: 'i-lucide-users' },
    { label: 'เครื่องมือ', to: '/admin/instruments', icon: 'i-lucide-flask-conical' },
    { label: 'ผู้อนุมัติ', to: '/admin/tool-approvers', icon: 'i-lucide-shield-check' },
    { label: 'ตั้งค่า', to: '/admin/settings', icon: 'i-lucide-settings' }
  ]
}

export function useNav() {
  const { role } = useAuth()

  const items = computed<NavItem[]>(() => {
    return role.value ? NAV[role.value] : []
  })

  const mobileTabs = computed<NavItem[]>(() => items.value.slice(0, 4))

  return { items, mobileTabs }
}
