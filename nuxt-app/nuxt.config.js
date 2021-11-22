import {
  getFullPodcastTitle,
  getFullSpeakerName,
  getSubpagePath,
} from './helpers';
import { getStrapiCollection } from './tools/getStrapiCollection';

export default {
  // Target: https://go.nuxtjs.dev/config-target
  target: 'static',

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'programmier.bar: Die Plattform für App- und Webentwicklung',
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
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
    script: [
      // Fathom Analytics
      {
        src: 'https://ziggy-stardust-six.programmier.bar/script.js',
        'data-site': 'XSJTTACD',
        defer: true,
      },
    ],
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
    // Sitemap Module for Nuxt
    '@nuxtjs/sitemap',
  ],

  // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  generate: {
    // https://github.com/nuxt-community/composition-api/issues/44
    interval: 1500,
    // Uncomment below to generate single routes
    // crawler: false,
    // exclude: [/^\/(\w|\d|-)*$/],
    // routes: ['/route/to/generate'],
    async routes() {
      const [podcasts, speakers, meetups] = await Promise.all([
        getStrapiCollection('podcasts'),
        getStrapiCollection('speakers'),
        getStrapiCollection('meetups'),
      ]);
      const routes = [];
      podcasts.forEach((podcast) => {
        routes.push(
          getSubpagePath('podcast', getFullPodcastTitle(podcast), podcast.id)
        );
      });
      speakers.forEach((speaker) => {
        routes.push(
          getSubpagePath(
            'hall-of-fame',
            getFullSpeakerName(speaker),
            speaker.id
          )
        );
      });
      meetups.forEach((meetup) => {
        routes.push(getSubpagePath('meetup', meetup.title, meetup.id));
      });
      return routes;
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

  // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  router: {
    middleware: ['fathom'],
  },

  // https://sitemap.nuxtjs.org/
  sitemap: {
    hostname: 'https://www.programmier.bar',
    exclude: ['/impressum', '/datenschutz'],
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},
};
