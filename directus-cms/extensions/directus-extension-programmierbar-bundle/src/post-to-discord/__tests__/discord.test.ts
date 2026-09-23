import { describe, expect, test } from '@jest/globals'
import { buildNewsEmbed, htmlToDiscordText } from '../discord.ts'

describe('buildNewsEmbed', () => {
    test('links to the website news page when a slug is present', () => {
        const payload = buildNewsEmbed({
            title: 'A great article',
            comment: '<p>Worth a read</p>',
            link: 'https://example.com/article',
            slug: 'a-great-article',
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].url).toBe('https://www.programmier.bar/news/a-great-article')
        expect(payload.embeds[0].title).toBe('A great article')
        expect(payload.embeds[0].description).toBe('Worth a read')
    })

    test('uses the brand color for the embed', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].color).toBe(0xcfff00)
    })

    test('strips a trailing slash from the website URL', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar/',
        })

        expect(payload.embeds[0].url).toBe('https://www.programmier.bar/news/s')
    })

    test('falls back to the external link when there is no slug', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            link: 'https://example.com/article',
            slug: null,
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].url).toBe('https://example.com/article')
    })

    test('throws when neither a slug nor an external link is available', () => {
        expect(() =>
            buildNewsEmbed({
                title: 'T',
                slug: null,
                link: null,
                websiteUrl: 'https://www.programmier.bar',
            })
        ).toThrow(/neither a news slug nor an external link/)
    })

    test('omits the description when there is no comment', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            comment: null,
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].description).toBeUndefined()
    })

    test('omits the description when the comment is only empty HTML', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            comment: '<p></p>',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].description).toBeUndefined()
    })

    test('converts rich-text HTML in the comment to Discord markdown', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            comment: '<p>Read <a href="https://example.com">this</a> now</p>',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].description).toBe('Read [this](https://example.com) now')
    })

    test('appends the member attribution after the comment', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            comment: '<p>Great read</p>',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
            memberName: 'Jane Doe',
        })

        expect(payload.embeds[0].description).toBe('Great read\n\n_Meinung von Jane Doe_')
    })

    test('shows the attribution even when there is no comment', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
            memberName: 'Jane Doe',
        })

        expect(payload.embeds[0].description).toBe('_Meinung von Jane Doe_')
    })

    test('ignores a blank member name', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            comment: '<p>Great read</p>',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
            memberName: '   ',
        })

        expect(payload.embeds[0].description).toBe('Great read')
    })

    test('adds an image from Open Graph metadata when present', () => {
        const payload = buildNewsEmbed({
            title: 'T',
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
            openGraph: { image: 'https://example.com/og.png' },
        })

        expect(payload.embeds[0].image).toEqual({ url: 'https://example.com/og.png' })
    })

    test('truncates an overly long title to the Discord limit', () => {
        const payload = buildNewsEmbed({
            title: 'x'.repeat(300),
            slug: 's',
            websiteUrl: 'https://www.programmier.bar',
        })

        expect(payload.embeds[0].title).toHaveLength(256)
        expect(payload.embeds[0].title.endsWith('…')).toBe(true)
    })
})

describe('htmlToDiscordText', () => {
    test('returns an empty string for empty input', () => {
        expect(htmlToDiscordText('')).toBe('')
    })

    test('strips plain formatting tags', () => {
        expect(htmlToDiscordText('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
    })

    test('converts anchors to masked markdown links', () => {
        expect(htmlToDiscordText('See <a href="https://example.com">the docs</a>')).toBe(
            'See [the docs](https://example.com)'
        )
    })

    test('falls back to the bare URL for an empty-text link', () => {
        expect(htmlToDiscordText('<a href="https://example.com"></a>')).toBe('https://example.com')
    })

    test('turns list items into bullet lines', () => {
        expect(htmlToDiscordText('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two')
    })

    test('separates paragraphs with a blank line', () => {
        expect(htmlToDiscordText('<p>a</p><p>b</p>')).toBe('a\n\nb')
    })

    test('turns <br> into a single newline', () => {
        expect(htmlToDiscordText('line<br>break')).toBe('line\nbreak')
    })

    test('decodes HTML entities', () => {
        expect(htmlToDiscordText('<p>Tom &amp; Jerry &lt;3 &nbsp;code</p>')).toBe('Tom & Jerry <3 code')
    })

    test('decodes named German umlaut entities case-sensitively', () => {
        expect(htmlToDiscordText('<p>&Uuml;ber Stra&szlig;e f&uuml;r M&auml;dchen &Ouml;l</p>')).toBe(
            'Über Straße für Mädchen Öl'
        )
    })

    test('decodes decimal and hex numeric entities', () => {
        expect(htmlToDiscordText('<p>M&#228;dchen f&#xFC;r</p>')).toBe('Mädchen für')
    })

    test('leaves an out-of-range numeric entity untouched instead of throwing', () => {
        expect(htmlToDiscordText('<p>&#9999999999;</p>')).toBe('&#9999999999;')
    })

    test('does not double-decode a literal escaped entity', () => {
        expect(htmlToDiscordText('<p>&amp;auml;</p>')).toBe('&auml;')
    })

    test('leaves unknown named entities untouched', () => {
        expect(htmlToDiscordText('<p>&unknownentity;</p>')).toBe('&unknownentity;')
    })
})
