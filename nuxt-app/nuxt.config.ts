import { directus } from './services';
import { DIRECTUS_CMS_URL } from './config';
import svgLoader from 'vite-svg-loader';
import { resolve } from 'path';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Target: https://go.nuxtjs.dev/config-target
  ssr: false,

  alias: {
    'shared-code': resolve(__dirname, '../shared-code/src'),
  },
  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [],
  runtimeConfig: {
    emailPassword: '',
  },

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
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
  ],

  // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  hooks: {
    async 'nitro:config'(nitroConfig) {
      if (nitroConfig.dev) {
        return;
      }
      const routes = await [
        { name: 'podcasts', path: 'podcast' },
        { name: 'speakers', path: 'hall-of-fame' },
        { name: 'meetups', path: 'meetup' },
      ].reduce(
        async (list, { name, path }) => [
          ...(await list),
          ...(
            ((
              await directus
                .items(name)
                .readByQuery({ fields: ['slug'], limit: -1 })
            ).data ?? []) as Array<{ slug: string }>
          ).map(({ slug }) => `/${path}/${slug}`),
        ],
        Promise.resolve([] as string[])
      );
      // ..Async logic..
      nitroConfig.prerender?.routes?.push(...routes);
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
});
