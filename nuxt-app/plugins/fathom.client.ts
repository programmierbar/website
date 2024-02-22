import VueFathom from '@ubclaunchpad/vue-fathom'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(VueFathom, {
        siteID: 'XSJTTACD',

        settings: {
            url: 'https://ziggy-stardust-six.programmier.bar/script.js',
            spa: 'history',
            honorDNT: false,
            canonical: true,
        },
    })
})
