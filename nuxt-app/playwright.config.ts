import { defineConfig, devices } from '@playwright/test'

/**
 * Route smoke tests — the Vitest suite runs in plain Node and never renders a page, so an upgrade
 * that breaks SSR passes every unit test.
 *
 * Deliberately not part of the pull-request gate; they run against the Vercel preview instead. See
 * .github/workflows/smoke_tests.yml for why.
 *
 * Locally:
 *   npm run build && npm run preview     # in one terminal
 *   npm run test:smoke                   # in another
 *
 * Against any deployment:
 *   SMOKE_BASE_URL=https://<preview>.vercel.app npm run test:smoke
 */
const baseURL = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

export default defineConfig({
    testDir: './tests-smoke',
    // `.smoke.ts`, not `.spec.ts`: Vitest globs `**/*.{test,spec}.ts` and would otherwise try to
    // run these as unit tests. The two runners must not overlap.
    testMatch: '**/*.smoke.ts',
    // Every check is a read-only GET, so there is no shared state to serialise on.
    fullyParallel: true,
    // No `workers` cap on purpose. One was added here once to stop pages reporting a blank
    // `<main>`; the real cause was a non-retrying assertion (see `expectPageRendered`), and capping
    // only hid it.
    forbidOnly: !!process.env.CI,
    // The CMS is a live dependency; one retry absorbs a transient blip without hiding a real
    // regression, which would fail both attempts.
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    // Generous on purpose: these pages server-render from live Directus content and the image
    // pipeline resizes on first request, so a cold `/podcast` legitimately takes several seconds.
    timeout: 45_000,
    // Sized for the heaviest page under full parallelism, where it can take ~9s to paint. Web-first
    // assertions resolve as soon as the condition holds, so a generous budget costs nothing when
    // things are fast and still fails a page that never renders.
    expect: { timeout: 30_000 },
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
