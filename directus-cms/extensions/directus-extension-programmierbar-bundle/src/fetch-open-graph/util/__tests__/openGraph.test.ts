import { describe, expect, test } from '@jest/globals'
import { buildOpenGraph, normalizeOpenGraph, parseMetaTags } from './../openGraph.ts'

const PAGE_URL = 'https://example.com/article'

const FULL_OG_HTML = `
<html>
  <head>
    <title>Fallback Title</title>
    <meta name="description" content="Fallback description" />
    <meta property="og:title" content="OG Title" />
    <meta property="og:description" content="OG Description" />
    <meta property="og:image" content="https://cdn.example.com/img.jpg" />
    <meta property="og:url" content="https://example.com/canonical" />
    <meta property="og:site_name" content="Example" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
</html>
`

describe('parseMetaTags', () => {
    test('collects og, twitter, description tags and the title', () => {
        const tags = parseMetaTags(FULL_OG_HTML)
        expect(tags).toMatchObject({
            'og:title': 'OG Title',
            'og:description': 'OG Description',
            'og:image': 'https://cdn.example.com/img.jpg',
            'og:site_name': 'Example',
            'og:type': 'article',
            'twitter:card': 'summary_large_image',
            description: 'Fallback description',
            title: 'Fallback Title',
        })
    })

    test('keeps the first occurrence of a repeated tag', () => {
        const tags = parseMetaTags(
            '<meta property="og:title" content="First"><meta property="og:title" content="Second">'
        )
        expect(tags['og:title']).toBe('First')
    })

    test('returns an empty map for a page without metadata', () => {
        expect(parseMetaTags('<html><body><p>no meta</p></body></html>')).toEqual({})
    })
})

describe('normalizeOpenGraph', () => {
    test('prefers Open Graph values', () => {
        const result = normalizeOpenGraph(parseMetaTags(FULL_OG_HTML), PAGE_URL)
        expect(result).toEqual({
            title: 'OG Title',
            description: 'OG Description',
            image: 'https://cdn.example.com/img.jpg',
            url: 'https://example.com/canonical',
            site_name: 'Example',
            type: 'article',
        })
    })

    test('falls back to twitter and plain HTML tags', () => {
        const html = `
            <title>HTML Title</title>
            <meta name="description" content="HTML description" />
            <meta name="twitter:image" content="https://cdn.example.com/tw.png" />
        `
        const result = normalizeOpenGraph(parseMetaTags(html), PAGE_URL)
        expect(result.title).toBe('HTML Title')
        expect(result.description).toBe('HTML description')
        expect(result.image).toBe('https://cdn.example.com/tw.png')
        // url falls back to the page URL, site_name/type absent
        expect(result.url).toBe(PAGE_URL)
        expect(result.site_name).toBeUndefined()
        expect(result.type).toBeUndefined()
    })

    test('resolves a relative og:image against the page URL', () => {
        const result = normalizeOpenGraph(parseMetaTags('<meta property="og:image" content="/media/pic.jpg">'), PAGE_URL)
        expect(result.image).toBe('https://example.com/media/pic.jpg')
    })

    test('yields undefined fields for a page with no metadata', () => {
        const result = normalizeOpenGraph({}, PAGE_URL)
        expect(result).toEqual({
            title: undefined,
            description: undefined,
            image: undefined,
            url: PAGE_URL,
            site_name: undefined,
            type: undefined,
        })
    })
})

describe('buildOpenGraph', () => {
    test('combines normalized fields with the raw tag map', () => {
        const result = buildOpenGraph(FULL_OG_HTML, PAGE_URL)
        expect(result.title).toBe('OG Title')
        expect(result.raw['twitter:card']).toBe('summary_large_image')
        expect(result.raw['og:title']).toBe('OG Title')
    })

    test('does not throw and returns an empty raw map for a metadata-less page', () => {
        const result = buildOpenGraph('<html></html>', PAGE_URL)
        expect(result.raw).toEqual({})
        expect(result.url).toBe(PAGE_URL)
        expect(result.title).toBeUndefined()
    })
})
