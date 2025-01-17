import { resolve } from 'path'
import svgLoader from 'vite-svg-loader'
// This import needs to be relative/file-based
// so that it can be resolved during the nuxt build process
import { useDirectus } from './composables/useDirectus'
import { DIRECTUS_CMS_URL, FLAG_SHOW_LOGIN, DEVTOOLS, DEV } from './config';

const directus = useDirectus()

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Target: https://go.nuxtjs.dev/config-target
  ssr: true,

  dev: DEV,

  devtools: {
    enabled: DEVTOOLS,
  },

  alias: {
      'shared-code': resolve(__dirname, '../shared-code'),
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [],

  runtimeConfig: {
      emailPassword: '',
      public: {
          FLAG_SHOW_LOGIN: FLAG_SHOW_LOGIN,
      },
  },

  // Plugins to run before rendering page: https://nuxt.com/docs/api/nuxt-config#plugins-1
  plugins: [],

  vite: {
      plugins: [
          svgLoader(), // https://github.com/jpkleemans/vite-svg-loader#readme
      ],
  },

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
      // https://go.nuxtjs.dev/pwa
      // '@nuxtjs/pwa',

      // Fathom Analytics
      // '@lostdesign/nuxt-fathom',
      // https://go.nuxtjs.dev/tailwindcss
      '@nuxtjs/tailwindcss',
      // https://v1.image.nuxtjs.org/get-started/
      '@nuxt/image-edge',
      // // Sitemap Module for Nuxt
      // '@nuxtjs/sitemap',
      'nuxt-jsonld',
      '@pinia/nuxt',
      '@nuxtjs/algolia',
  ],

  // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  hooks: {
      async 'nitro:config'(nitroConfig) {
          if (nitroConfig.dev) {
              return
          }

          const routes: string[] = []

          const podcasts = await directus.getPodcasts()
          routes.push(...podcasts.map((podcast) => `/podcast/${podcast.slug}`))

          const meetups = await directus.getMeetups()
          routes.push(...meetups.map((meetup) => `/meetup/${meetup.slug}`))

          const speakers = await directus.getSpeakers()
          routes.push(...speakers.map((speaker) => `/hall-of-fame/${speaker.slug}`))

          // ..Async logic..
          nitroConfig.prerender?.routes?.push(...routes)
      },
  },

  // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  // router: {
  //   // Fathom Analytics
  //   middleware: ['fathom'],
  // },

  // // PWA module configuration: https://go.nuxtjs.dev/pwa
  // pwa: {
  //   manifest: {
  //     lang: 'de',
  //     name: 'programmier.bar: Die Plattform für App- und Webentwicklung',
  //     short_name: 'programmier.bar',
  //     description:
  //       'Podcast, Meetups und Community: Wir bieten euch Deep Dives in Technologien und andere Themen, die uns in der Web- und App-Entwicklung beschäftigen.',
  //     display: 'standalone',
  //     background_color: '#000000',
  //     theme_color: '#000000',
  //   },
  // },

  // https://sitemap.nuxtjs.org/
  // sitemap: {
  //   hostname: 'https://www.programmier.bar',
  //   exclude: ['/impressum', '/datenschutz'],
  // },

  // // Fathom Analytics
  // fathom: {
  //   namespace: 'fathom', // optional
  //   spa: 'history', // recommended
  //   siteId: 'XSJTTACD',
  //   url: 'https://ziggy-stardust-six.programmier.bar/script.js',
  //   honorDNT: false,
  //   canonical: true,
  // },

  // https://image.nuxtjs.org/
  image: {
      domains: [DIRECTUS_CMS_URL.replace(/^https?:\/\//, '')],
      alias: {
          cms: `${DIRECTUS_CMS_URL}/assets`,
      },
      screens: {
          xs: 520,
          sm: 640,
          md: 768,
          lg: 1024,
          xl: 1280,
          '2xl': 1536,
          '3xl': 2000,
      },
  },

  compatibilityDate: '2025-01-17',
})