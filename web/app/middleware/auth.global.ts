const PUBLIC_ROUTES = new Set(['/login', '/register', '/forgot-password'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, ready, fetchMe, homePath } = useAuth()

  if (!ready.value) {
    await fetchMe()
  }

  const isPublic = PUBLIC_ROUTES.has(to.path)

  if (!user.value && !isPublic) {
    return navigateTo('/login')
  }

  if (user.value && isPublic) {
    return navigateTo(homePath.value)
  }
})
