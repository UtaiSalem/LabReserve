// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  ssr: true,

  runtimeConfig: {
    // Overridden at runtime by NUXT_LEGACY_API_BASE (Nuxt env-var auto-mapping).
    legacyApiBase: 'http://localhost:8775',
    public: {
      appName: 'LabReserve'
    }
  },

  app: {
    head: {
      title: 'LabReserve — ระบบจองเครื่องมือวิทยาศาสตร์',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1E3A8A' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap'
        }
      ],
      htmlAttrs: { lang: 'th' }
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
