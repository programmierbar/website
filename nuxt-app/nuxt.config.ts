import { resolve } from 'path'
import svgLoader from 'vite-svg-loader'
// This import needs to be relative/file-based
// so that it can be resolved during the nuxt build process
import { useDirectus } from './composables/useDirectus'
import {
    DEV,
    DEVTOOLS,
    DIRECTUS_CMS_URL,
    DISCORD_INVITE_LINK,
    FLAG_ENABLE_UI_PREVIEWS,
    FLAG_SHOW_LOGIN,
    FLAG_SHOW_NEWS,
    FLAG_SHOW_NEWSLETTER,
} from './config'
import { enableDirectusRetries } from './services'

const directus = useDirectus()

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    app: {
        head: {
            script: [
                // Synchronous inline script: adds the class before first paint so cursor: none
                // CSS (scoped to html.js-custom-cursor) only applies when JS is enabled.
                // When JS is disabled, this script never runs and the default cursor stays visible.
                { innerHTML: "document.documentElement.classList.add('js-custom-cursor')" },
            ],
        },
    },

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
    css: ['vue-json-pretty/lib/styles.css'],

    runtimeConfig: {
        // Email (SMTP)
        emailFrom: 'noreply@programmier.bar', // Set via NUXT_EMAIL_FROM env var
        emailSmtpHost: 'smtp.gmail.com', // Set via NUXT_EMAIL_SMTP_HOST env var
        emailSmtpPort: '465', // Set via NUXT_EMAIL_SMTP_PORT env var
        emailSmtpUser: '', // Set via NUXT_EMAIL_SMTP_USER env var
        emailSmtpPass: '', // Set via NUXT_EMAIL_SMTP_PASS env var
        directusApiToken: '', // Set via NUXT_DIRECTUS_API_TOKEN env var
        geminiApiKey: '', // Set via NUXT_GEMINI_API_KEY env var
        stripeSecretKey: '', // Set via NUXT_STRIPE_SECRET_KEY env var
        stripeWebhookSecret: '', // Set via NUXT_STRIPE_WEBHOOK_SECRET env var
        public: {
            FLAG_SHOW_LOGIN: FLAG_SHOW_LOGIN,
            FLAG_SHOW_NEWS: FLAG_SHOW_NEWS,
            FLAG_SHOW_NEWSLETTER: FLAG_SHOW_NEWSLETTER,
            FLAG_ENABLE_UI_PREVIEWS: FLAG_ENABLE_UI_PREVIEWS,
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
        build: {
            // Do not remove without setting `css.lightningcss.targets`: Vite's lightningcss default
            // rewrites media queries to Level 4 range syntax, which needs Safari 16.4+ and drops
            // every breakpoint at once on older versions rather than degrading.
            cssMinify: 'esbuild',
        },
    },

    // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules

    // Modules: https://go.nuxtjs.dev/config-modules
    modules: [
        // https://go.nuxtjs.dev/pwa
        // '@nuxtjs/pwa',

        //  https://go.nuxtjs.dev/tailwindcss
        '@nuxtjs/tailwindcss',
        // https://image.nuxt.com/get-started/installation
        '@nuxt/image',
        // // Sitemap Module for Nuxt
        // '@nuxtjs/sitemap',
        'nuxt-jsonld',
        '@pinia/nuxt',
        '@nuxtjs/algolia',
        // Generates .nuxt/eslint.config.mjs, which eslint.config.mjs extends — so linting
        // requires `nuxt prepare` to have run.
        '@nuxt/eslint',
    ],

    // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
    hooks: {
        async 'nitro:config'(nitroConfig) {
            if (nitroConfig.dev) {
                return
            }

            // Keep image URLs out of the prerender crawl. Following them makes the crawler resize
            // every `<nuxt-img>` variant it finds — 1476 files and ~100 MB from 44 routes — and
            // exhaust connections to the CMS, which fails the build via `failOnError`.
            //
            // Keep the `static` guard even though there is no `generate` script any more: `npx nuxi
            // generate` still works, sets `nitro.static`, and produces no server. There the crawler's
            // output *is* what serves these URLs, so skipping it would silently 404 every optimised
            // image instead of failing loudly.
            if (!nitroConfig.static) {
                nitroConfig.prerender ??= {}
                nitroConfig.prerender.ignore ??= []
                nitroConfig.prerender.ignore.push('/_ipx')
            }

            // Lets CI build without the CMS being reachable. Skips route discovery only — the
            // bundle is still built in full, and deploys never set it.
            if (process.env.SKIP_PRERENDER_ROUTE_DISCOVERY === 'true') {
                console.info('[nitro:config] SKIP_PRERENDER_ROUTE_DISCOVERY set — skipping CMS route discovery')
                return
            }

            // The route-discovery fetches below are read-only and run before
            // prerendering, so transient Directus failures may retry safely.
            enableDirectusRetries()

            const routes: string[] = [
                '/',
                '/podcast',
                '/meetup',
                '/konferenz',
                '/hall-of-fame',
                '/ueber-uns',
                '/impressum',
                '/datenschutz',
                '/kontakt',
                '/verhaltensregeln',
                '/aufnahmen',
                '/pick-of-the-day',
            ]

            const podcasts = await directus.getPodcasts(10)
            routes.push(...podcasts.map((podcast) => `/podcast/${podcast.slug}`))

            const meetups = await directus.getMeetups(3)
            routes.push(...meetups.map((meetup) => `/meetup/${meetup.slug}`))

            const conferences = await directus.getConferences()
            routes.push(...conferences.map((conference) => `/konferenz/${conference.slug}`))

            const speakers = await directus.getSpeakersForBuild(15)
            routes.push(...speakers.map((speaker) => `/hall-of-fame/${speaker.slug}`))

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

    // https://image.nuxt.com/get-started/configuration
    //
    // An `alias` entry would not work here: this app uses ipx, and alias resolution is skipped when
    // the provider sets `supportsAlias: true`, as both ipx providers do. Keys must also start with `/`.
    image: {
        domains: [DIRECTUS_CMS_URL.replace(/^https?:\/\//, '')],
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
            failOnError: true,
        },
        externals: {
            // Do not remove: Pinia 4 ships only its bundler build, so externalising it leaves Vue's
            // compile-time flags as undefined globals and every SSR route 500s. Inlining puts it
            // through rollup, which substitutes them. Only reproducible under NODE_ENV=production,
            // so no gate here catches it — retest with a real request, not `npm run build`.
            //
            // Temporary. Remove once `npm view pinia exports --json` shows a `node` or `production`
            // condition on `"."` again. Full diagnosis: docs/dependency-upgrade-plan.md,
            // "Waiting on upstream: the Pinia 4 export map".
            inline: ['pinia'],
        },
    },

    routeRules: {
        '/**': { isr: 3600 },

        '/konferenz/*/tickets': { isr: false },
        '/konferenz/*/tickets/**': { isr: false },
        '/ticket-portal': { isr: false },
        '/speaker-portal': { isr: false },
        '/suche': { isr: false },
        '/api/**': { isr: false },

        // Render per-request from the `?token=` (and `?preview=`) query. Under
        // ISR the first query-less render (invalid) would be cached and served
        // for every token, breaking confirmation — same reason as the portals.
        '/newsletter/confirm': { isr: false },
        '/newsletter/unsubscribe': { isr: false },

        // /app UA-branches between iOS/Android store URLs on conference hosts;
        // a cached response would pin the first-seen platform for everyone.
        '/app': { isr: false },

        // Not in use currently
        //'/login-callback': { isr: false },
        //'/login': { isr: false },
        //'/profile-creation': { isr: false },
    },
})
