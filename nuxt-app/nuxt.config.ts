import { resolve } from 'path'
import svgLoader from 'vite-svg-loader'
// This import needs to be relative/file-based
// so that it can be resolved during the nuxt build process
import { useDirectus } from './composables/useDirectus'
import { DEV, DEVTOOLS, DIRECTUS_CMS_URL, FLAG_SHOW_LOGIN, DISCORD_INVITE_LINK } from './config'

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
    css: [
      'vue-json-pretty/lib/styles.css',
    ],

    runtimeConfig: {
        // Email (Mailgun API)
        emailTransport: 'mailgun', // Set via NUXT_EMAIL_TRANSPORT env var
        emailFrom: 'noreply@programmier.bar', // Set via NUXT_EMAIL_FROM env var
        emailMailgunApiKey: '', // Set via NUXT_EMAIL_MAILGUN_API_KEY env var
        emailMailgunDomain: '', // Set via NUXT_EMAIL_MAILGUN_DOMAIN env var
        emailMailgunHost: 'api.eu.mailgun.net', // Set via NUXT_EMAIL_MAILGUN_HOST env var
        directusAdminToken: '', // Set via NUXT_DIRECTUS_ADMIN_TOKEN env var
        directusTicketToken: '', // Set via NUXT_DIRECTUS_TICKET_TOKEN env var
        geminiApiKey: '', // Set via NUXT_GEMINI_API_KEY env var
        stripeSecretKey: '', // Set via NUXT_STRIPE_SECRET_KEY env var
        stripeWebhookSecret: '', // Set via NUXT_STRIPE_WEBHOOK_SECRET env var
        public: {
            FLAG_SHOW_LOGIN: FLAG_SHOW_LOGIN,
            DISCORD_INVITE_LINK: DISCORD_INVITE_LINK,
            directusCmsUrl: DIRECTUS_CMS_URL,
            stripePublishableKey: '', // Set via NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env var
        },
    },

    // Plugins to run before rendering page: https://nuxt.com/docs/api/nuxt-config#plugins-1
    plugins: [],

    vite: {
        plugins: [
            svgLoader(), // https://github.com/jpkleemans/vite-svg-loader#readme
            './plugins/vue-json-pretty.js',
        ],
    },

    // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules

    // Modules: https://go.nuxtjs.dev/config-modules
    modules: [
        // https://go.nuxtjs.dev/pwa
        // '@nuxtjs/pwa',

        //  https://go.nuxtjs.dev/tailwindcss
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

            // Fetch podcast slug history and generate redirect rules
            try {
                const slugHistory = await directus.getPodcastSlugHistory()
                if (slugHistory && slugHistory.length > 0) {
                    nitroConfig.routeRules = nitroConfig.routeRules || {}
                    let redirectCount = 0
                    for (const entry of slugHistory) {
                        const oldPath = `/podcast/${entry.oldSlug}`
                        const newPath = `/podcast/${entry.currentSlug}`
                        if (nitroConfig.routeRules[oldPath]) {
                            console.warn(`Podcast slug redirect conflict: "${oldPath}" already has a route rule, skipping`)
                            continue
                        }
                        nitroConfig.routeRules[oldPath] = {
                            redirect: { to: newPath, statusCode: 301 },
                        }
                        redirectCount++
                    }
                    console.log(`Generated ${redirectCount} podcast slug redirect(s)`)
                }
            } catch (error) {
                console.warn('Failed to fetch podcast slug history for redirects:', error)
            }

            // ..Async logic..
            nitroConfig.prerender?.routes?.push(...routes)
        },
    },

    //

    //  PWA module configuration: https://go.nuxtjs.dev/pwa
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

    nitro: {
        prerender: {
            // Don't fail build on prerender errors for image routes
            // which require the CMS server to be running
            failOnError: false,
        },
    },
})
