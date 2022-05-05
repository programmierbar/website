import { directus } from './services';
import { DIRECTUS_CMS_URL } from './config';

export default {
  // Target: https://go.nuxtjs.dev/config-target
  target: 'static',

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      { name: 'theme-color', content: '#000000' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    htmlAttrs: {
      lang: 'de',
    },
    bodyAttrs: {
      class: 'bg-black',
    },
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [],

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/typescript
    '@nuxt/typescript-build',
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/tailwindcss',
    // https://composition-api.nuxtjs.org/
    '@nuxtjs/composition-api/module',
    // https://image.nuxtjs.org/
    '@nuxt/image',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    // SVG loading module for Nuxt.js
    '@nuxtjs/svg',
    // Sitemap Module for Nuxt
    '@nuxtjs/sitemap',
    // Fathom Analytics
    '@lostdesign/nuxt-fathom',
  ],

  // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  generate: {
    fallback: '404.html',
    concurrency: 5,
    routes() {
      return [
        { name: 'podcasts', path: 'podcast' },
        { name: 'speakers', path: 'hall-of-fame' },
        { name: 'meetups', path: 'meetup' },
      ].reduce(
        async (list, { name, path }) => [
          ...(await list),
          ...(
            await directus.items(name).readMany({ fields: ['slug'], limit: -1 })
          ).data.map(({ slug }) => `/${path}/${slug}`),
        ],
        Promise.resolve([])
      );
    },
  },

  // PWA module configuration: https://go.nuxtjs.dev/pwa
  pwa: {
    manifest: {
      lang: 'de',
      name: 'programmier.bar: Die Plattform für App- und Webentwicklung',
      short_name: 'programmier.bar',
      description:
        'Podcast, Meetups und Community: Wir bieten euch Deep Dives in Technologien und andere Themen, die uns in der Web- und App-Entwicklung beschäftigen.',
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#000000',
    },
  },

  // https://sitemap.nuxtjs.org/
  sitemap: {
    hostname: 'https://www.programmier.bar',
    exclude: ['/impressum', '/datenschutz'],
  },

  // Fathom Analytics
  fathom: {
    namespace: 'fathom', // optional
    spa: 'history', // recommended
    siteId: 'XSJTTACD',
    url: 'https://ziggy-stardust-six.programmier.bar/script.js',
    honorDNT: false,
    canonical: true,
  },

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

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},
};
