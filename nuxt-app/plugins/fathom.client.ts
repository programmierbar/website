import { defineNuxtPlugin } from '#app'
import { FATHOM_INCLUDED_DOMAINS } from '~/config'
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
        includedDomains: FATHOM_INCLUDED_DOMAINS,
    })
})
