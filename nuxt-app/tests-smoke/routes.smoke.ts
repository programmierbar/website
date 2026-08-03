import { expect, test, type Page } from '@playwright/test'

/**
 * Route smoke tests — the check the Vitest suite cannot make: does the page actually render?
 *
 * Assertions are deliberately structural rather than content-specific. The pages are driven by
 * live Directus content, so anything that asserts on copy would break every time an editor
 * changes a headline. What these catch is the failure mode that matters during a dependency
 * upgrade: a route that 500s, renders the error page, or comes back blank.
 */

/**
 * The blank-page check: a route can return 200 and still render nothing if the page component
 * throws or resolves to empty data. Note this must assert on `<main>` specifically — the app
 * shell (header, footer, podcast player) lives outside `<nuxt-page />` in app.vue and renders
 * even when the page itself does not.
 */
async function expectPageRendered(page: Page, label: string) {
    await expect(page.locator('h1', { hasText: /^Error \d{3}$/ }), `${label} rendered the error page`).toHaveCount(0)

    // One locator for both assertions, so it is explicit that they check the same element.
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // `expect.poll`, not a bare `expect` over an awaited `innerText()`. `<main>` becomes visible
    // before the page component has necessarily painted its content, so reading the text once and
    // asserting on that number is a race with no retry — it reported "empty <main>" on pages whose
    // SSR response was verified complete. Polling keeps the visible-text semantics (hidden content
    // still counts as blank, which is the failure this check exists to catch) and simply waits for
    // it, up to the `expect` timeout.
    await expect
        .poll(async () => (await main.innerText()).trim().length, {
            message: `${label} rendered an empty <main>`,
        })
        .toBeGreaterThan(0)
}

/** Static routes that must render for anonymous visitors. */
const PUBLIC_ROUTES = [
    '/',
    '/podcast',
    '/meetup',
    '/konferenz',
    '/hall-of-fame',
    '/pick-of-the-day',
    '/ueber-uns',
    '/aufnahmen',
    '/kontakt',
    '/impressum',
    '/datenschutz',
    '/verhaltensregeln',
    // isr: false — rendered per request, so it exercises a different Nitro path than the rest.
    '/suche',
]

for (const route of PUBLIC_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
        const response = await page.goto(route)

        expect(response?.status(), `${route} should return 200`).toBe(200)
        await expectPageRendered(page, route)
    })
}

test('renders a podcast detail page', async ({ page }) => {
    // Follow a real link rather than hardcoding a slug — slugs come from the CMS and change.
    await page.goto('/podcast')
    const firstEpisode = page.locator('a[href^="/podcast/"]').first()
    await expect(firstEpisode).toBeVisible()

    const href = await firstEpisode.getAttribute('href')
    expect(href).toBeTruthy()

    const response = await page.goto(href!)
    expect(response?.status(), `${href} should return 200`).toBe(200)
    await expectPageRendered(page, href!)

    // Separate signal from the render check above: the player mounts from app.vue on *every* page,
    // outside <nuxt-page />, so this proves the shell hydrated — not that this page rendered. It is
    // invisible until a podcast is selected, hence attachment rather than visibility.
    await expect(page.getByTestId('podcast-player')).toBeAttached()
})

test('renders a speaker detail page', async ({ page }) => {
    await page.goto('/hall-of-fame')
    const firstSpeaker = page.locator('a[href^="/hall-of-fame/"]').first()
    await expect(firstSpeaker).toBeVisible()

    const href = await firstSpeaker.getAttribute('href')
    const response = await page.goto(href!)
    expect(response?.status(), `${href} should return 200`).toBe(200)
    await expectPageRendered(page, href!)
})

test('serves the news RSS feed as valid XML', async ({ request }) => {
    const response = await request.get('/feed/news.xml')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')

    const body = await response.text()
    expect(body).toContain('<rss')
    expect(body).toContain('</rss>')
})

test('returns 404 for an unknown route', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist')

    expect(response?.status()).toBe(404)
    await expect(page.locator('h1', { hasText: 'Error 404' })).toBeVisible()
})

test('home page loads without console or network errors', async ({ page }) => {
    const consoleErrors: string[] = []
    const failedRequests: string[] = []

    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text())
        }
    })
    page.on('response', (response) => {
        // Third-party analytics/fonts failing is not our regression; own-origin 5xx is.
        if (response.status() >= 500 && new URL(response.url()).origin === new URL(page.url()).origin) {
            failedRequests.push(`${response.status()} ${response.url()}`)
        }
    })

    await page.goto('/')
    // Not 'networkidle': the page keeps a trickle of requests going (analytics, lazily loaded
    // media), so it never settles. Wait for load, then give client-side hydration a moment to
    // throw if it is going to.
    await page.waitForLoadState('load')
    await page.waitForTimeout(3_000)

    expect(failedRequests, 'same-origin 5xx responses').toEqual([])
    expect(consoleErrors, 'browser console errors').toEqual([])
})
