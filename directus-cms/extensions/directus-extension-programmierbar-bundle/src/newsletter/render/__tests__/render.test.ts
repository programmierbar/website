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
            {
                sort: 2,
                podcasts_id: {
                    status: 'published',
                    slug: 'news-12-zweite',
                    type: 'news',
                    number: '12',
                    title: 'Zweite',
                },
            },
            {
                sort: 1,
                podcasts_id: {
                    status: 'published',
                    slug: 'deep-dive-200-erste',
                    type: 'deep_dive',
                    number: '200',
                    title: 'Erste',
                },
            },
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
                meetups_id: {
                    status: 'published',
                    slug: 'rust-im-alltag',
                    title: 'Rust im Alltag',
                    start_on: '2026-11-12T17:30:00Z',
                },
            },
            { sort: 2, meetups_id: { status: 'published', slug: null, title: 'Ohne Slug', start_on: null } },
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
        const { html, warnings, hidden } = await renderNewsletterIssue(
            issue([textBlock(1, 'Hallo', '<p>Willkommen</p>'), podcastsBlock, meetupsBlock]),
            OPTIONS
        )

        expect(warnings).toEqual([])
        expect(hidden).toEqual([])
        expect(html).toContain('<title>Ausgabe Oktober</title>')
        expect(html).toContain('Das ist neu')
        expect(html).toContain('<h2>Hallo</h2>')
        expect(html).toContain('<p>Willkommen</p>')
        expect(html).toContain(
            '<a href="https://www.programmier.bar/podcast/deep-dive-200-erste?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=ausgabe-oktober">Deep Dive 200 – Erste</a>'
        )
        expect(html).toContain(
            '<a href="https://www.programmier.bar/podcast/news-12-zweite?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=ausgabe-oktober">News 12: Zweite</a>'
        )
        expect(html).toContain(
            '<a href="https://www.programmier.bar/meetup/rust-im-alltag?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=ausgabe-oktober">Rust im Alltag</a>'
        )
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
                                        status: 'published',
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
        expect(mjml).toContain(
            'href="https://www.programmier.bar/podcast/a%22b?utm_source=newsletter&amp;utm_medium=email'
        )
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

describe('published filter', () => {
    const mixedPodcasts = (statuses: Array<string | null | undefined>): NewsletterIssueBlock => ({
        sort: 1,
        collection: 'newsletter_blocks_podcasts',
        item: {
            heading: 'Folgen',
            podcasts: statuses.map((status, index) => ({
                sort: index,
                podcasts_id: {
                    status,
                    slug: `folge-${index}`,
                    type: 'news',
                    number: String(index),
                    title: `Folge ${index}`,
                },
            })),
        },
    })

    test('hides unpublished podcasts and meetups and reports them', async () => {
        const { html, hidden, warnings } = await renderNewsletterIssue(
            issue([
                mixedPodcasts(['published', 'draft', 'archived', null]),
                {
                    sort: 2,
                    collection: 'newsletter_blocks_meetups',
                    item: {
                        heading: 'Meetups',
                        meetups: [
                            { sort: 1, meetups_id: { status: 'published', slug: 'live', title: 'Live-Meetup' } },
                            { sort: 2, meetups_id: { status: 'draft', slug: 'geheim', title: 'Geheim-Meetup' } },
                        ],
                    },
                },
            ]),
            OPTIONS
        )

        expect(html).toContain('folge-0')
        expect(html).not.toMatch(/folge-1|folge-2|folge-3|Folge 1|Folge 2|Folge 3/)
        expect(html).toContain('Live-Meetup')
        expect(html).not.toContain('Geheim-Meetup')
        expect(hidden).toEqual([
            { collection: 'podcasts', title: 'News 1: Folge 1', status: 'draft', reason: 'unpublished' },
            { collection: 'podcasts', title: 'News 2: Folge 2', status: 'archived', reason: 'unpublished' },
            { collection: 'podcasts', title: 'News 3: Folge 3', status: null, reason: 'unpublished' },
            { collection: 'meetups', title: 'Geheim-Meetup', status: 'draft', reason: 'unpublished' },
        ])
        expect(warnings).toEqual([])
    })

    test('a podcast block without any published episode renders nothing and is reported', async () => {
        const { html, hidden, warnings } = await renderNewsletterIssue(
            issue([textBlock(0, 'Davor', '<p>x</p>'), mixedPodcasts(['draft'])]),
            OPTIONS
        )

        expect(html).not.toContain('Folgen')
        expect(html).not.toContain('block-podcasts')
        expect(html).toContain('Davor')
        expect(hidden).toHaveLength(1)
        expect(warnings).toEqual(['Podcast-Block „Folgen“ übersprungen: keine veröffentlichte Folge'])
    })

    test('a meetup block without any published meetup renders nothing and is reported', async () => {
        const { html, warnings } = await renderNewsletterIssue(
            issue([
                {
                    sort: 1,
                    collection: 'newsletter_blocks_meetups',
                    item: { heading: null, meetups: [{ sort: 1, meetups_id: { status: 'archived', title: 'Alt' } }] },
                },
            ]),
            OPTIONS
        )

        expect(html).not.toContain('block-meetups')
        expect(warnings).toEqual(['Meetup-Block übersprungen: kein veröffentlichtes Meetup'])
    })

    test('counts the blocks that produced markup; 0 when every entry is hidden or deleted', async () => {
        const mixed = await renderNewsletterIssue(
            issue([textBlock(0, 'Davor', '<p>x</p>'), mixedPodcasts(['draft'])]),
            OPTIONS
        )
        expect(mixed.renderedBlocks).toBe(1)

        const empty = await renderNewsletterIssue(
            issue([
                mixedPodcasts(['draft', 'archived']),
                { sort: 3, collection: 'newsletter_blocks_text', item: null },
            ]),
            OPTIONS
        )
        expect(empty.renderedBlocks).toBe(0)
    })

    test('the rendered html never contains a preview notice', async () => {
        const { html, hidden } = await renderNewsletterIssue(issue([mixedPodcasts(['draft', 'published'])]), OPTIONS)
        expect(hidden).toHaveLength(1)
        expect(html).not.toContain('data-preview-notice')
        expect(html).not.toContain('ausgeblendet')
    })
})

describe('campaign parameters', () => {
    test('website links carry utm parameters with the subject slug as campaign', () => {
        const mjml = buildIssueMjml(issue([podcastsBlock], { subject: 'Neues aus der Bar: Oktober!' }), OPTIONS)
        expect(mjml).toContain(
            'href="https://www.programmier.bar/podcast/deep-dive-200-erste?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=neues-aus-der-bar-oktober"'
        )
    })

    test('without a subject the campaign parameter is left out', () => {
        const mjml = buildIssueMjml(issue([podcastsBlock], { subject: null }), OPTIONS)
        expect(mjml).toContain('podcast/deep-dive-200-erste?utm_source=newsletter&amp;utm_medium=email"')
    })

    test('the unsubscribe link gets no utm parameters', () => {
        const mjml = buildIssueMjml(issue([]), { ...OPTIONS, unsubscribeUrl: 'https://www.programmier.bar/u?token=1' })
        expect(mjml).toContain('href="https://www.programmier.bar/u?token=1"')
    })
})
