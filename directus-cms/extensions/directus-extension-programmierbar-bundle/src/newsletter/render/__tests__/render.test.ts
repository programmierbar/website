import { describe, expect, test } from '@jest/globals'
import { buildIssueMjml, renderNewsletterIssue } from '../index.ts'
import type { NewsletterIssue, NewsletterIssueBlock } from '../types.ts'

const OPTIONS = { websiteUrl: 'https://www.programmier.bar/' }

const textBlock = (sort: number | null, heading: string, body: string): NewsletterIssueBlock => ({
    sort,
    collection: 'newsletter_blocks_text',
    item: { heading, body },
})

const podcastsBlock: NewsletterIssueBlock = {
    sort: 2,
    collection: 'newsletter_blocks_podcasts',
    item: {
        heading: 'Neue Folgen',
        podcasts: [
            { sort: 2, podcasts_id: { slug: 'news-12-zweite', type: 'news', number: '12', title: 'Zweite' } },
            { sort: 1, podcasts_id: { slug: 'deep-dive-200-erste', type: 'deep_dive', number: '200', title: 'Erste' } },
            { sort: 3, podcasts_id: null },
        ],
    },
}

const meetupsBlock: NewsletterIssueBlock = {
    sort: 3,
    collection: 'newsletter_blocks_meetups',
    item: {
        heading: 'Meetups',
        meetups: [
            {
                sort: 1,
                meetups_id: { slug: 'rust-im-alltag', title: 'Rust im Alltag', start_on: '2026-11-12T17:30:00Z' },
            },
            { sort: 2, meetups_id: { slug: null, title: 'Ohne Slug', start_on: null } },
        ],
    },
}

const issue = (blocks: NewsletterIssueBlock[], extra: Partial<NewsletterIssue> = {}): NewsletterIssue => ({
    subject: 'Ausgabe Oktober',
    preheader: 'Das ist neu',
    blocks,
    ...extra,
})

describe('renderNewsletterIssue', () => {
    test('renders subject, preheader and every block type without MJML errors', async () => {
        const { html, warnings } = await renderNewsletterIssue(
            issue([textBlock(1, 'Hallo', '<p>Willkommen</p>'), podcastsBlock, meetupsBlock]),
            OPTIONS
        )

        expect(warnings).toEqual([])
        expect(html).toContain('<title>Ausgabe Oktober</title>')
        expect(html).toContain('Das ist neu')
        expect(html).toContain('<h2>Hallo</h2>')
        expect(html).toContain('<p>Willkommen</p>')
        expect(html).toContain(
            '<a href="https://www.programmier.bar/podcast/deep-dive-200-erste">Deep Dive 200 – Erste</a>'
        )
        expect(html).toContain('<a href="https://www.programmier.bar/podcast/news-12-zweite">News 12: Zweite</a>')
        expect(html).toContain('<a href="https://www.programmier.bar/meetup/rust-im-alltag">Rust im Alltag</a>')
        expect(html).toContain('Donnerstag, 12. November 2026 um 18:30 Uhr')
        // A meetup without slug is listed, but not linked.
        expect(html).toContain('<li>Ohne Slug</li>')
    })

    test('omits the preview text when there is no preheader', async () => {
        const { html } = await renderNewsletterIssue(issue([], { preheader: null }), OPTIONS)
        expect(html).not.toContain('Das ist neu')
        expect(html).toContain('<title>Ausgabe Oktober</title>')
    })

    test('renders the unsubscribe placeholder in the preview and the real link when given', async () => {
        const preview = await renderNewsletterIssue(issue([]), OPTIONS)
        expect(preview.html).toContain('[Abmeldelink wird beim Versand eingesetzt]')

        const sent = await renderNewsletterIssue(issue([]), {
            ...OPTIONS,
            unsubscribeUrl: 'https://www.programmier.bar/newsletter/unsubscribe?token=a&b',
        })
        expect(sent.html).toContain(
            '<a href="https://www.programmier.bar/newsletter/unsubscribe?token=a&amp;b">Newsletter abbestellen</a>'
        )
        expect(sent.html).not.toContain('[Abmeldelink')
    })

    test('reports skipped blocks as warnings instead of failing', async () => {
        const { warnings } = await renderNewsletterIssue(
            issue([
                { sort: 1, collection: 'newsletter_blocks_text', item: null },
                { sort: 2, collection: 'newsletter_blocks_unknown', item: { heading: 'x' } },
            ]),
            OPTIONS
        )
        expect(warnings).toEqual([
            'Block (newsletter_blocks_text) ohne Inhalt übersprungen',
            "Unbekannter Blocktyp 'newsletter_blocks_unknown' übersprungen",
        ])
    })
})

describe('buildIssueMjml', () => {
    test('orders blocks by sort, nulls last, ties in incoming order', () => {
        const mjml = buildIssueMjml(
            issue([
                textBlock(null, 'Ohne Sort', '<p>d</p>'),
                textBlock(3, 'Drei', '<p>c</p>'),
                textBlock(1, 'Eins A', '<p>a</p>'),
                textBlock(1, 'Eins B', '<p>b</p>'),
            ]),
            OPTIONS
        )
        const order = ['Eins A', 'Eins B', 'Drei', 'Ohne Sort'].map((heading) => mjml.indexOf(`<h2>${heading}</h2>`))
        expect(order.every((index) => index >= 0)).toBe(true)
        expect([...order].sort((a, b) => a - b)).toEqual(order)
    })

    test('orders podcasts within a block by their junction sort', () => {
        const mjml = buildIssueMjml(issue([podcastsBlock]), OPTIONS)
        expect(mjml.indexOf('Erste')).toBeLessThan(mjml.indexOf('Zweite'))
    })

    test('does not mutate the input', () => {
        const blocks = [textBlock(2, 'B', ''), textBlock(1, 'A', '')]
        buildIssueMjml(issue(blocks), OPTIONS)
        expect(blocks.map((block) => block.sort)).toEqual([2, 1])
    })
})

describe('escaping', () => {
    test('escapes plain-text fields', () => {
        const mjml = buildIssueMjml(
            issue(
                [
                    textBlock(1, '<b>Heading</b> & "Co"', ''),
                    {
                        sort: 2,
                        collection: 'newsletter_blocks_podcasts',
                        item: {
                            heading: null,
                            podcasts: [
                                {
                                    sort: 1,
                                    podcasts_id: {
                                        slug: 'a"b',
                                        type: 'news',
                                        number: '1',
                                        title: '</mj-text><script>',
                                    },
                                },
                            ],
                        },
                    },
                ],
                { subject: '</mj-title><mj-raw>x</mj-raw>', preheader: '<i>p</i>' }
            ),
            OPTIONS
        )

        expect(mjml).toContain('<mj-title>&lt;/mj-title&gt;&lt;mj-raw&gt;x&lt;/mj-raw&gt;</mj-title>')
        expect(mjml).toContain('<mj-preview>&lt;i&gt;p&lt;/i&gt;</mj-preview>')
        expect(mjml).toContain('<h2>&lt;b&gt;Heading&lt;/b&gt; &amp; &quot;Co&quot;</h2>')
        expect(mjml).toContain('href="https://www.programmier.bar/podcast/a%22b"')
        expect(mjml).toContain('News 1: &lt;/mj-text&gt;&lt;script&gt;')
        expect(mjml).not.toContain('<script>')
    })

    test('sanitizes rich text but keeps the editor formatting', () => {
        const body =
            '<p onclick="x()">Hallo <strong>fett</strong> <em>kursiv</em> <a href="https://example.com" target="_blank">Link</a></p>' +
            '<ul><li>eins</li></ul><blockquote>Zitat</blockquote><code>c</code>' +
            '<script>alert(1)</script><style>p{}</style><a href="javascript:alert(1)">böse</a><img src="x" onerror="y">' +
            '</mj-text></mj-column><mj-raw>raus</mj-raw>'
        const mjml = buildIssueMjml(issue([textBlock(1, '', body)]), OPTIONS)

        expect(mjml).toContain(
            '<p>Hallo <strong>fett</strong> <em>kursiv</em> <a href="https://example.com" target="_blank">Link</a></p>'
        )
        expect(mjml).toContain('<ul><li>eins</li></ul><blockquote>Zitat</blockquote><code>c</code>')
        expect(mjml).not.toMatch(/script|onclick|onerror|<style|javascript:|<img|mj-raw/)
        expect(mjml).toContain('<a>böse</a>')
    })
})
