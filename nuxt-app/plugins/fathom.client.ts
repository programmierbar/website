import { defineNuxtPlugin } from '#app';
import VueFathom from '@ubclaunchpad/vue-fathom';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueFathom, {
    siteID: 'XSJTTACD',

    settings: {
      url: 'https://ziggy-stardust-six.programmier.bar/script.js',
      spa: 'history',
      honorDNT: false,
      canonical: true,
    },
  });
});
