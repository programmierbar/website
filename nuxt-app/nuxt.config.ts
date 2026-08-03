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
            // Vite 8 defaults CSS minification to lightningcss, which rewrites every media query
            // to Level 4 range syntax — `@media (width>=1024px)` instead of `@media
            // (min-width:1024px)`. That is shorter but needs Safari 16.4+ (March 2023), and there
            // is no browserslist here to constrain it, so lightningcss assumes modern targets.
            // On Safari 16.0–16.3 the whole responsive layout would be dropped rather than
            // degrading, since every breakpoint stops matching at once.
            //
            // Pinning esbuild keeps the `min-width` output the app shipped on Nuxt 3. Revisit
            // alongside Tailwind 4 (Phase 6), where lightningcss can be adopted deliberately with
            // explicit `css.lightningcss.targets` rather than as a silent default.
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
    ],

    // Router configuration: https://nuxtjs.org/docs/configuration-glossary/configuration-router
    hooks: {
        async 'nitro:config'(nitroConfig) {
            if (nitroConfig.dev) {
                return
            }

            // CI builds the app to prove a dependency change still compiles; that check must not
            // depend on the production CMS being reachable, or an unrelated Directus blip turns
            // every PR red. Setting this opts out of route discovery only — the bundle is still
            // built in full. Deploys never set it, so prerendering is unaffected.
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
    // No `alias` entry on purpose. There used to be `alias: { cms: '<cms>/assets' }`, intended so
    // that `src="/cms/<file-id>"` would expand to the Directus asset URL. It never worked, for
    // three independent reasons, and was removed rather than fixed because nothing needs it:
    //   1. Nothing referenced it — image URLs come from `helpers/getAssetUrl.ts`, which already
    //      builds absolute Directus URLs, and Algolia results carry absolute URLs too.
    //   2. Alias keys must start with `/`. The resolver normalises a relative src with
    //      `withLeadingSlash` before matching, so `input.startsWith('cms')` could never be true.
    //   3. Decisively: alias resolution is guarded by `if (!provider.supportsAlias)`, and both ipx
    //      providers set `supportsAlias: true`. This app uses ipx, so that branch never ran.
    // If a shorthand is ever wanted, the working form is `alias: { '/cms': '<cms>/assets' }`.
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
            // Bundle pinia into the server output instead of leaving it external.
            //
            // Without this, every SSR request throws in production and only in production:
            //   ReferenceError: __VUE_PROD_DEVTOOLS__ is not defined
            //     at createPinia (.output/server/node_modules/pinia/dist/pinia.js)
            //
            // Pinia 4 exports a single unconditional entry, `./dist/pinia.js`, which is the
            // bundler build — it references Vue's compile-time feature flags raw, expecting a
            // bundler to substitute them (its esm-browser and iife builds have them pre-baked;
            // this one has five). Nitro externalises dependencies into
            // `.output/server/node_modules`, so nothing substitutes anything and the flag is just
            // an undefined global at runtime. Vue itself avoids this by shipping a `node`
            // conditional export to a CJS build that branches on `process.env.NODE_ENV`; Pinia 4
            // has no such condition.
            //
            // It is production-only because the guard reads
            // `process.env.NODE_ENV !== 'production' || __VUE_PROD_DEVTOOLS__` — in development the
            // first clause short-circuits and the flag is never evaluated. So `nuxt dev` and a bare
            // `node .output/server/index.mjs` both look fine; `nuxt preview` and any real deploy
            // set NODE_ENV=production and every route 500s.
            //
            // Inlining puts pinia through rollup, which substitutes the flags (verified: zero
            // unreplaced references, and exactly one `createPinia` in the output, so there is no
            // second module instance splitting the store registry).
            //
            // Remove this when Pinia ships a node-safe build. See the follow-up backlog.
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
