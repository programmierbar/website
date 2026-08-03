import { defineConfig, devices } from '@playwright/test'

/**
 * Route smoke tests.
 *
 * These exist because the Vitest suite runs in a plain Node environment and never renders a page
 * — an upgrade that breaks SSR passes every unit test. See docs/dependency-upgrade-plan.md.
 *
 * They are deliberately NOT part of the pull-request gate. The pages they hit are server-rendered
 * from live Directus data, so running them on every PR would make CI fail whenever the CMS
 * hiccups. Instead they run against the Vercel preview deployment once it is ready
 * (.github/workflows/smoke_tests.yml), which is also the only place they test the real thing.
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
    // Parallel everywhere. This was previously forced to 1 worker locally, on the theory that a
    // single `nuxt preview` process could not keep up with concurrent requests — 6 workers produced
    // 6 failures and 2 workers flaked 1-in-3, all of them pages reporting a blank `<main>`.
    // Saturation was the trigger but not the cause: the blank-render assertion read `innerText()`
    // once and asserted on the resulting number, so it never retried and any slow paint failed it.
    // With that assertion polling (see `expectPageRendered`), 6 workers pass repeatedly and finish
    // in ~14s against ~23s serial, so there is nothing left for the cap to protect.
    workers: undefined,
    forbidOnly: !!process.env.CI,
    // The CMS is a live dependency; one retry absorbs a transient blip without hiding a real
    // regression, which would fail both attempts.
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    // Generous on purpose: these pages server-render from live Directus content and the image
    // pipeline resizes on first request, so a cold `/podcast` legitimately takes several seconds.
    timeout: 45_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
