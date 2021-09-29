export default {
  // Target: https://go.nuxtjs.dev/config-target
  target: 'static',

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'programmier.bar: Die Plattform für App- und Webentwicklung',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content:
          'Wir wollen euch die Möglichkeiten bieten, euer Wissen in den Bereichen App- und Webentwicklung zu vertiefen und einen Blick hinter die Kulissen zu werfen, bei einer ganz entspannten Atmosphäre.',
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
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/pwa
    '@nuxtjs/pwa',
    // SVG loading module for Nuxt.js
    '@nuxtjs/svg',
  ],

  generate: {
    // https://github.com/nuxt-community/composition-api/issues/44
    interval: 1500,
  },

  // PWA module configuration: https://go.nuxtjs.dev/pwa
  pwa: {
    manifest: {
      lang: 'de',
      name: 'programmier.bar: Die Plattform für App- und Webentwicklung',
      short_name: 'programmier.bar',
      description:
        'Wir wollen euch die Möglichkeiten bieten, euer Wissen in den Bereichen App- und Webentwicklung zu vertiefen und einen Blick hinter die Kulissen zu werfen, bei einer ganz entspannten Atmosphäre.',
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#000000',
    },
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},
};
