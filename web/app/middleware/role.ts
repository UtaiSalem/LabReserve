import type { UserRole } from '~/composables/useAuth'

/**
 * Page-level middleware: ใช้ผ่าน definePageMeta({ middleware: 'role', roles: ['requester'] })
 * หรือกำหนดจาก meta.roles
 */
export default defineNuxtRouteMiddleware((to) => {
  const allowed = (to.meta.roles as UserRole[] | undefined) || []
  if (allowed.length === 0) return

  const { user, homePath } = useAuth()
  if (!user.value) return navigateTo('/login')

  if (!allowed.includes(user.value.role)) {
    return navigateTo(homePath.value)
  }
})
