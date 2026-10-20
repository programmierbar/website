import { describe, expect, test } from '@jest/globals'
import { bioExcerpt, excerpt, renderProfileOverview } from '../util/profileOverview.ts'

const SPEAKER = {
    academic_title: 'Dr.',
    first_name: 'Erika',
    last_name: 'Mustermann',
    occupation: 'Head of Engineering bei Beispiel GmbH',
    description: '<p>Erika Mustermann arbeitet <strong>remote</strong>.</p>',
    profile_image: 'file-1',
    event_image: null,
    linkedin_url: 'https://www.linkedin.com/in/erika',
    github_url: 'https://github.com/erika',
    twitter_url: '',
}

describe('renderProfileOverview', () => {
    test('lists name, occupation, bio, the links that are set and the image state', () => {
        const html = renderProfileOverview(SPEAKER)

        expect(html).toContain('Dr. Erika Mustermann')
        expect(html).toContain('Head of Engineering bei Beispiel GmbH')
        expect(html).toContain('Erika Mustermann arbeitet remote.')
        expect(html).toContain('LinkedIn, GitHub')
        expect(html).not.toContain('Twitter')
        expect(html).toMatch(/Profilbild<\/td><td[^>]*>vorhanden/)
        expect(html).toMatch(/Action Shot<\/td><td[^>]*><em>fehlt<\/em>/)
    })

    test('escapes every value from the speaker record, since the template inserts it raw', () => {
        const html = renderProfileOverview({
            ...SPEAKER,
            first_name: '<script>alert(1)</script>',
            occupation: 'CTO bei "Foo & Bar" <GmbH>',
            // Entities in the stored rich text decode to text first and must come out escaped again.
            description: '<p>&lt;img src=x onerror=alert(1)&gt; &amp; mehr</p>',
        })

        expect(html).not.toContain('<script>')
        expect(html).not.toContain('<img')
        expect(html).not.toContain('<GmbH>')
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        expect(html).toContain('CTO bei &quot;Foo &amp; Bar&quot; &lt;GmbH&gt;')
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; mehr')
    })

    test('encodes curly braces, so speaker text cannot become a template placeholder', () => {
        const html = renderProfileOverview({ ...SPEAKER, occupation: 'CTO {{portal_url}} {{{x}}}' })

        expect(html).not.toContain('{')
        expect(html).not.toContain('}')
        expect(html).toContain('CTO &#123;&#123;portal_url&#125;&#125;')
    })

    test('marks missing values instead of leaving the row empty', () => {
        const html = renderProfileOverview({
            first_name: 'Erika',
            last_name: 'Mustermann',
            occupation: '  ',
            description: null,
        })

        expect(html).toMatch(/Jobtitel und Unternehmen<\/td><td[^>]*><em>noch nicht angegeben<\/em>/)
        expect(html).toMatch(/Bio<\/td><td[^>]*><em>noch nicht angegeben<\/em>/)
        expect(html).toMatch(/Links<\/td><td[^>]*><em>keine<\/em>/)
        expect(html).toMatch(/Profilbild<\/td><td[^>]*><em>fehlt<\/em>/)
    })
})

describe('bioExcerpt', () => {
    test('strips tags, keeps link text and collapses whitespace', () => {
        expect(bioExcerpt('<p>Erst</p>\n<ul><li>eins</li><li><a href="https://x.de">zwei</a></li></ul>')).toBe(
            'Erst - eins - zwei'
        )
    })

    test('shortens a long bio at a word boundary with an ellipsis, at most 300 characters', () => {
        const long = `<p>${'Wort '.repeat(100)}</p>`
        const result = bioExcerpt(long)

        expect(result.length).toBeLessThanOrEqual(300)
        expect(result.endsWith('Wort…')).toBe(true)
    })
})

describe('excerpt', () => {
    test('leaves short text alone', () => {
        expect(excerpt('kurz', 10)).toBe('kurz')
    })

    test('cuts inside a word when there is no boundary close to the limit', () => {
        expect(excerpt('a'.repeat(20), 10)).toBe(`${'a'.repeat(9)}…`)
    })
})
