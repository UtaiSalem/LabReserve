import { proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const target = `${config.legacyApiBase}${event.path}`

  return proxyRequest(event, target, {
    cookieDomainRewrite: '',
    cookiePathRewrite: '/',
    // override-merge: empty string makes legacy's `!req.headers.origin` check pass
    headers: {
      origin: '',
      referer: ''
    },
    fetchOptions: {
      redirect: 'manual'
    }
  })
})
