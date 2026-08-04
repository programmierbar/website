/**
 * Makes a CMS-entered link safe to put in an `href`, or returns `undefined` if it cannot be.
 *
 * Editors sometimes leave the scheme off — `www.linkedin.com/in/someone` rather than
 * `https://www.linkedin.com/in/someone`. A browser resolves that against the current page, so the
 * link lands on `/hall-of-fame/www.linkedin.com/in/someone` and 404s on our own domain. The prerender
 * crawler follows it too, which fails `npm run generate`.
 *
 * Values that cannot be a host — `@jSchaback` — are dropped rather than guessed at: turning a handle
 * into a profile URL needs to know the platform, and a wrong guess is a link that looks fine and goes
 * nowhere. Callers should omit the link entirely when this returns `undefined`.
 *
 * A bare username that happens to contain a dot (`t.muelleer`) is indistinguishable from a bare domain
 * (`example.com`), which is a legitimate `website_url`, so it still becomes `https://t.muelleer` and
 * fails to resolve. That is deliberately not solved here — the point is that a bad link leaves our
 * domain and fails as somebody else's problem, instead of rendering a 404 that looks like ours.
 *
 * @param url The raw value from the CMS.
 *
 * @returns An absolute URL, or `undefined` when the value is not usable as one.
 */
export function normalizeExternalUrl(url: string | null | undefined): string | undefined {
    const trimmed = url?.trim()

    if (!trimmed) {
        return undefined
    }

    // Already absolute (`https:`, `mailto:`), protocol-relative, or deliberately site-internal.
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/')) {
        return trimmed
    }

    // What precedes the first `/`, `?` or `#` has to work as a host. A dot is the cheapest test that
    // separates `twitter.com/devpg` from a bare username, and it rejects a leading `@` outright.
    const host = trimmed.split(/[/?#]/)[0]

    if (!host || host.startsWith('@') || !host.includes('.')) {
        return undefined
    }

    return `https://${trimmed}`
}
