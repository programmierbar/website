import { defineConfig } from 'vitest/config'

// Plain-Node unit/integration tests (no Nuxt app boot). Server-route handlers
// are exercised in-process with their Nuxt auto-imports stubbed per test, and
// composables run against a stubbed global `$fetch`.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.{test,spec}.ts'],
        exclude: ['node_modules', '.nuxt', '.output', 'dist'],
    },
})
