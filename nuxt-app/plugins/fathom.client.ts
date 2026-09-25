import { defineNuxtPlugin } from '#app'
import { load } from 'fathom-client'

export default defineNuxtPlugin(() => {
    load('XSJTTACD', {
        url: 'https://ziggy-stardust-six.programmier.bar/script.js',
        spa: 'history',
        honorDNT: false,
        canonical: true,
    })
})
