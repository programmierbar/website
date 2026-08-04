import { describe, expect, it } from 'vitest'
import { normalizeExternalUrl, type ExternalUrlKind } from '../helpers/normalizeExternalUrl'

// The cases named after real CMS records are the reason this exists. A schemeless value in an `href`
// is resolved against the current page, so `www.linkedin.com/in/x` became
// `/hall-of-fame/www.linkedin.com/in/x` — a 404 on our own domain for the visitor, and a build failure
// for `npm run generate`, whose crawler follows it.

const ALL_KINDS: ExternalUrlKind[] = [
    'web',
    'twitter',
    'instagram',
    'linkedin',
    'github',
    'youtube',
    'bluesky',
    'mastodon',
]

describe('normalizeExternalUrl', () => {
    describe('regardless of kind', () => {
        it('leaves an absolute URL alone', () => {
            for (const kind of ALL_KINDS) {
                expect(normalizeExternalUrl('https://www.linkedin.com/in/claudiaplattner', kind)).toBe(
                    'https://www.linkedin.com/in/claudiaplattner'
                )
                expect(normalizeExternalUrl('http://example.com', kind)).toBe('http://example.com')
                expect(normalizeExternalUrl('mailto:hallo@programmier.bar', kind)).toBe('mailto:hallo@programmier.bar')
                expect(normalizeExternalUrl('//cdn.example.com/x', kind)).toBe('//cdn.example.com/x')
            }
        })

        it('adds the missing scheme to a schemeless URL', () => {
            // Both were live in the CMS and 404'd on our own domain.
            expect(normalizeExternalUrl('www.linkedin.com/in/mariekilg/', 'linkedin')).toBe(
                'https://www.linkedin.com/in/mariekilg/'
            )
            expect(normalizeExternalUrl('twitter.com/devpg', 'twitter')).toBe('https://twitter.com/devpg')
        })

        it('handles absent and whitespace-only input', () => {
            for (const kind of ALL_KINDS) {
                expect(normalizeExternalUrl(undefined, kind)).toBeUndefined()
                expect(normalizeExternalUrl(null, kind)).toBeUndefined()
                expect(normalizeExternalUrl('', kind)).toBeUndefined()
                expect(normalizeExternalUrl('   ', kind)).toBeUndefined()
            }
        })

        it('trims before deciding', () => {
            expect(normalizeExternalUrl('  twitter.com/devpg  ', 'twitter')).toBe('https://twitter.com/devpg')
            expect(normalizeExternalUrl('  @jSchaback  ', 'twitter')).toBe('https://twitter.com/jSchaback')
        })

        it('never returns something a browser resolves against the current page', () => {
            // The property that actually matters.
            const inputs = ['www.linkedin.com/in/x/', 'twitter.com/devpg', 't.muelleer', '@jSchaback', 'plainname', '']
            for (const kind of ALL_KINDS) {
                for (const input of inputs) {
                    const out = normalizeExternalUrl(input, kind)
                    if (out !== undefined) {
                        expect(out, `${kind} / ${JSON.stringify(input)}`).toMatch(/^([a-z][a-z0-9+.-]*:|\/)/i)
                    }
                }
            }
        })
    })

    describe("kind 'web' (the default)", () => {
        it('accepts a bare host', () => {
            expect(normalizeExternalUrl('example.com')).toBe('https://example.com')
            expect(normalizeExternalUrl('sub.example.co.uk/path?a=1#b')).toBe('https://sub.example.co.uk/path?a=1#b')
        })

        it('drops a value that cannot be a host, because a website field has no handle form', () => {
            expect(normalizeExternalUrl('justausername')).toBeUndefined()
            expect(normalizeExternalUrl('@someone')).toBeUndefined()
        })

        it('is what you get when kind is omitted', () => {
            expect(normalizeExternalUrl('example.com')).toBe(normalizeExternalUrl('example.com', 'web'))
        })
    })

    describe('social handles', () => {
        it('resolves the two handles that are actually in the CMS', () => {
            // johannes-schaback | twitter_url = "@jSchaback"
            expect(normalizeExternalUrl('@jSchaback', 'twitter')).toBe('https://twitter.com/jSchaback')
            // tobias-m-mueller | instagram_url = "t.muelleer" — a dot is legal in an Instagram username,
            // which is exactly why the kind is needed to tell it apart from a hostname.
            expect(normalizeExternalUrl('t.muelleer', 'instagram')).toBe('https://www.instagram.com/t.muelleer')
        })

        it('builds profile URLs per platform', () => {
            expect(normalizeExternalUrl('devpg', 'twitter')).toBe('https://twitter.com/devpg')
            expect(normalizeExternalUrl('someone', 'instagram')).toBe('https://www.instagram.com/someone')
            expect(normalizeExternalUrl('mariekilg', 'linkedin')).toBe('https://www.linkedin.com/in/mariekilg')
            expect(normalizeExternalUrl('octocat', 'github')).toBe('https://github.com/octocat')
            expect(normalizeExternalUrl('programmierbar', 'youtube')).toBe('https://www.youtube.com/@programmierbar')
        })

        it('strips a leading @ where the platform does not use one', () => {
            expect(normalizeExternalUrl('@octocat', 'github')).toBe('https://github.com/octocat')
            expect(normalizeExternalUrl('@someone', 'instagram')).toBe('https://www.instagram.com/someone')
        })

        it('re-adds the @ that YouTube handles require', () => {
            expect(normalizeExternalUrl('@programmierbar', 'youtube')).toBe('https://www.youtube.com/@programmierbar')
        })

        it('treats a Bluesky handle as a handle, not a host', () => {
            // Bluesky handles are domains, so the dot heuristic used for `web` would be wrong here.
            expect(normalizeExternalUrl('programmier.bar', 'bluesky')).toBe('https://bsky.app/profile/programmier.bar')
            expect(normalizeExternalUrl('someone.bsky.social', 'bluesky')).toBe(
                'https://bsky.app/profile/someone.bsky.social'
            )
        })

        it('splits a Mastodon handle into instance and user', () => {
            expect(normalizeExternalUrl('@podcast@social.programmier.bar', 'mastodon')).toBe(
                'https://social.programmier.bar/@podcast'
            )
        })

        it('drops a Mastodon handle with no instance, since the server cannot be guessed', () => {
            expect(normalizeExternalUrl('@podcast', 'mastodon')).toBeUndefined()
            expect(normalizeExternalUrl('podcast', 'mastodon')).toBeUndefined()
        })

        it("recognises the platform's own host rather than treating it as a handle", () => {
            expect(normalizeExternalUrl('x.com/devpg', 'twitter')).toBe('https://x.com/devpg')
            expect(normalizeExternalUrl('youtu.be/abc123', 'youtube')).toBe('https://youtu.be/abc123')
            expect(normalizeExternalUrl('bsky.app/profile/someone', 'bluesky')).toBe('https://bsky.app/profile/someone')
        })
    })
})
