import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain-Node unit/integration tests (no Nuxt app boot). Server-route handlers
// are exercised in-process with their Nuxt auto-imports stubbed per test, and
// composables run against a stubbed global `$fetch`.
export default defineConfig({
    // Server routes import shared helpers via Nuxt's `~` alias; mirror it so they load outside Nuxt.
    resolve: {
        alias: { '~': fileURLToPath(new URL('.', import.meta.url)) },
    },
    test: {
        environment: 'node',
        include: ['**/*.{test,spec}.ts'],
        // `tests-smoke` holds Playwright route smoke tests (see playwright.config.ts). They need
        // a real browser and a running server, so Vitest must not pick them up.
        exclude: ['node_modules', '.nuxt', '.output', 'dist', 'tests-smoke'],
    },
})
