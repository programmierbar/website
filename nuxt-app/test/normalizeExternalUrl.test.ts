import { describe, expect, it } from 'vitest'
import { normalizeExternalUrl } from '../helpers/normalizeExternalUrl'

// The cases named after real CMS records are the reason this exists. A schemeless value in an `href`
// is resolved against the current page, so `www.linkedin.com/in/x` became
// `/hall-of-fame/www.linkedin.com/in/x` — a 404 on our own domain for the visitor, and a build failure
// for `npm run generate`, whose crawler follows it.

describe('normalizeExternalUrl', () => {
    it('leaves an absolute URL alone', () => {
        expect(normalizeExternalUrl('https://www.linkedin.com/in/claudiaplattner')).toBe(
            'https://www.linkedin.com/in/claudiaplattner'
        )
        expect(normalizeExternalUrl('http://example.com')).toBe('http://example.com')
        expect(normalizeExternalUrl('mailto:hallo@programmier.bar')).toBe('mailto:hallo@programmier.bar')
        expect(normalizeExternalUrl('//cdn.example.com/x')).toBe('//cdn.example.com/x')
    })

    it('adds the missing scheme to a schemeless URL', () => {
        // Both of these were live in the CMS and 404'd on our own domain.
        expect(normalizeExternalUrl('www.linkedin.com/in/mariekilg/')).toBe('https://www.linkedin.com/in/mariekilg/')
        expect(normalizeExternalUrl('twitter.com/devpg')).toBe('https://twitter.com/devpg')
        expect(normalizeExternalUrl('example.com')).toBe('https://example.com')
        expect(normalizeExternalUrl('sub.example.co.uk/path?a=1#b')).toBe('https://sub.example.co.uk/path?a=1#b')
    })

    it('drops a handle, because no correct URL can be derived from it', () => {
        // Real CMS value. `https://@jSchaback` would leave our domain but still go nowhere, and
        // guessing `https://twitter.com/jSchaback` requires knowing the platform.
        expect(normalizeExternalUrl('@jSchaback')).toBeUndefined()
        expect(normalizeExternalUrl('@user@mastodon.social')).toBeUndefined()
    })

    it('drops a value that cannot be a host', () => {
        expect(normalizeExternalUrl('justausername')).toBeUndefined()
        expect(normalizeExternalUrl('/relative-with-no-host')).toBe('/relative-with-no-host')
    })

    it('handles absent and whitespace-only input', () => {
        expect(normalizeExternalUrl(undefined)).toBeUndefined()
        expect(normalizeExternalUrl(null)).toBeUndefined()
        expect(normalizeExternalUrl('')).toBeUndefined()
        expect(normalizeExternalUrl('   ')).toBeUndefined()
    })

    it('trims surrounding whitespace before deciding', () => {
        expect(normalizeExternalUrl('  twitter.com/devpg  ')).toBe('https://twitter.com/devpg')
        expect(normalizeExternalUrl('  https://example.com  ')).toBe('https://example.com')
    })

    it('never returns a value that a browser would resolve against the current page', () => {
        // The property that actually matters: whatever comes back is either absolute, root-relative, or
        // nothing at all. A bare `foo.com/bar` in an href is what caused the original bug.
        for (const input of [
            'www.linkedin.com/in/mariekilg/',
            'twitter.com/devpg',
            't.muelleer',
            '@jSchaback',
            'justausername',
            'https://example.com',
            'mailto:a@b.de',
            '',
        ]) {
            const out = normalizeExternalUrl(input)
            if (out !== undefined) {
                expect(out, `input ${JSON.stringify(input)}`).toMatch(/^([a-z][a-z0-9+.-]*:|\/)/i)
            }
        }
    })
})
