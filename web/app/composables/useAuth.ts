export type UserRole = 'requester' | 'approver' | 'staff' | 'admin'

export interface CurrentUser {
  id?: number | string
  username: string
  name?: string
  email?: string
  role: UserRole
  department?: string
  [key: string]: unknown
}

export const ROLE_HOME: Record<UserRole, string> = {
  requester: '/requester',
  approver: '/approver',
  staff: '/staff',
  admin: '/admin/users'
}

export function useAuth() {
  const user = useState<CurrentUser | null>('auth.user', () => null)
  const ready = useState<boolean>('auth.ready', () => false)
  const api = useApi()

  async function fetchMe() {
    try {
      const res = await api<{ user: CurrentUser | null }>('/me')
      user.value = res.user
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
    return user.value
  }

  async function login(username: string, password: string) {
    const res = await api<{ user: CurrentUser }>('/login', {
      method: 'POST',
      body: { username, password }
    })
    user.value = res.user
    return res.user
  }

  async function logout() {
    try {
      await api('/logout', { method: 'POST' })
    } finally {
      user.value = null
      await navigateTo('/login')
    }
  }

  const isLoggedIn = computed(() => !!user.value)
  const role = computed(() => user.value?.role)
  const homePath = computed(() => (role.value ? ROLE_HOME[role.value] : '/login'))

  return {
    user,
    ready,
    isLoggedIn,
    role,
    homePath,
    fetchMe,
    login,
    logout
  }
}
