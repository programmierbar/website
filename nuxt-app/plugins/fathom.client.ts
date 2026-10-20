import { defineNuxtPlugin } from '#app'
import { load } from 'fathom-client'

export default defineNuxtPlugin(() => {
    load('XSJTTACD', {
        url: 'https://ziggy-stardust-six.programmier.bar/script.js',
        spa: 'history',
        honorDNT: false,
        // Must stay false. The script records a client-side navigation as soon as the router calls
        // `pushState`, before Nuxt has updated the canonical link, so reading the canonical would
        // attribute every navigation to the previous page.
        canonical: false,
        // Previews and local runs load this plugin too. Without the canonical link they would report
        // their own hostname into the production site's totals.
        includedDomains: ['www.programmier.bar'],
    })
})
