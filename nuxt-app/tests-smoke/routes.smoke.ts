import { expect, test } from '@playwright/test'

/**
 * Route smoke tests — the check the Vitest suite cannot make: does the page actually render?
 *
 * Assertions are deliberately structural rather than content-specific. The pages are driven by
 * live Directus content, so anything that asserts on copy would break every time an editor
 * changes a headline. What these catch is the failure mode that matters during a dependency
 * upgrade: a route that 500s, renders the error page, or comes back blank.
 */

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

        // error.vue renders "Error 404" in an h1 — catches a route that resolves but errors.
        await expect(page.locator('h1', { hasText: /^Error \d{3}$/ })).toHaveCount(0)

        // A blank body is the other silent failure: 200 with a hydration/render crash.
        await expect(page.locator('main')).toBeVisible()
        const text = await page.locator('main').innerText()
        expect(text.trim().length, `${route} rendered an empty <main>`).toBeGreaterThan(0)
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
    await expect(page.locator('h1', { hasText: /^Error \d{3}$/ })).toHaveCount(0)
    // The player mounts from app.vue on every page and is the component most likely to break on a
    // Vue or Pinia upgrade. It is invisible until a podcast is selected, so assert attachment
    // rather than visibility.
    await expect(page.getByTestId('podcast-player')).toBeAttached()
})

test('renders a speaker detail page', async ({ page }) => {
    await page.goto('/hall-of-fame')
    const firstSpeaker = page.locator('a[href^="/hall-of-fame/"]').first()
    await expect(firstSpeaker).toBeVisible()

    const href = await firstSpeaker.getAttribute('href')
    const response = await page.goto(href!)
    expect(response?.status(), `${href} should return 200`).toBe(200)
    await expect(page.locator('h1', { hasText: /^Error \d{3}$/ })).toHaveCount(0)
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
