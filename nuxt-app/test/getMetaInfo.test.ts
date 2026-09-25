import { describe, expect, it } from 'vitest'
import { DEFAULT_OG_IMAGE, WEBSITE_URL } from '../config'
import { getMetaInfo } from '../helpers/getMetaInfo'
import { getTrimmedString } from '../helpers/getTrimmedString'
import type { FileItem } from '../types'

type Meta = ReturnType<typeof getMetaInfo>['meta'][number]

function getContent(meta: Meta[], key: string) {
    const tags = meta.filter((tag) => ('name' in tag ? tag.name : tag.property) === key)
    expect(tags.length, `number of ${key} tags`).toBeLessThanOrEqual(1)
    return tags[0]?.content
}

const cover: FileItem = { id: 'cover-id', title: 'Cover Deep Dive 123', type: 'image/jpeg', width: 1500, height: 1500 }

describe('getTrimmedString', () => {
    it('returns short strings unchanged', () => {
        expect(getTrimmedString('Kurz', 10)).toBe('Kurz')
        expect(getTrimmedString('Genau zehn', 10)).toBe('Genau zehn')
    })

    it('cuts at a word boundary and stays within the limit', () => {
        const text = 'Diese Woche geht es um zwei Modell-Releases an einem Tag'
        const trimmed = getTrimmedString(text, 30)
        expect(trimmed).toBe('Diese Woche geht es um zwei…')
        expect(trimmed.length).toBeLessThanOrEqual(30)
    })

    it('keeps a word that ends exactly at the limit', () => {
        expect(getTrimmedString('abcd efgh ijkl', 10)).toBe('abcd efgh…')
    })

    it('drops trailing punctuation before the ellipsis', () => {
        expect(getTrimmedString('Erster Satz. Zweiter Satz geht weiter', 14)).toBe('Erster Satz…')
    })

    it('cuts inside a word if there is no boundary close to the limit', () => {
        expect(getTrimmedString('Donaudampfschifffahrtsgesellschaft', 10)).toBe('Donaudamp…')
    })

    it('does not cut an emoji in half', () => {
        const trimmed = getTrimmedString('Prost🍻zusammen', 7)
        expect(trimmed).toBe('Prost…')
        expect(trimmed).not.toMatch(/[\uD800-\uDFFF]/)
        expect(getTrimmedString('Prost🍻zusammen', 8)).toBe('Prost🍻…')
    })

    it('handles tiny limits and strings without any words', () => {
        expect(getTrimmedString('Hallo', 0)).toBe('')
        expect(getTrimmedString('Hallo', 1)).toBe('…')
        expect(getTrimmedString('Hallo', 2)).toBe('H…')
        expect(getTrimmedString('!!!!!!!!!!', 5)).toBe('…')
    })
})

describe('getMetaInfo', () => {
    it('does not cut the title and adds the website name to subpages', () => {
        const title = 'Deep Dive 123 – Ein ziemlich langer Titel mit mehr als vierzig Zeichen'
        const { title: documentTitle, meta } = getMetaInfo({ type: 'website', path: '/podcast/x', title })
        expect(documentTitle).toBe(`${title} | programmier.bar`)
        expect(getContent(meta, 'og:title')).toBe(title)
        expect(getContent(meta, 'twitter:title')).toBe(title)
    })

    it('does not add the website name to the home page', () => {
        expect(getMetaInfo({ type: 'website', path: '/', title: 'programmier.bar' }).title).toBe('programmier.bar')
    })

    it('sets canonical URL, og:url, site name and locale', () => {
        const { link, meta } = getMetaInfo({ type: 'website', path: '/kontakt', title: 'Kontakt' })
        expect(link).toEqual([{ rel: 'canonical', href: `${WEBSITE_URL}/kontakt` }])
        expect(getContent(meta, 'og:url')).toBe(`${WEBSITE_URL}/kontakt`)
        expect(getContent(meta, 'og:site_name')).toBe('programmier.bar')
        expect(getContent(meta, 'og:locale')).toBe('de_DE')
    })

    it('collapses whitespace in descriptions and trims them at a word boundary', () => {
        const description = `Das war verheerend.\n\nPS: Grüße ${'und noch mehr Text '.repeat(10)}`
        const { meta } = getMetaInfo({ type: 'website', path: '/x', title: 'X', description })
        const content = getContent(meta, 'description')!
        expect(content.startsWith('Das war verheerend. PS: Grüße und noch mehr Text')).toBe(true)
        expect(content.length).toBeLessThanOrEqual(160)
        expect(content.endsWith('…')).toBe(true)
        expect(content).not.toMatch(/\s…$/)
        expect(getContent(meta, 'og:description')).toBe(content)
        expect(getContent(meta, 'twitter:description')).toBe(content)
    })

    it('omits the description tags if there is no description', () => {
        const { meta } = getMetaInfo({ type: 'website', path: '/x', title: 'X', description: ' \n ' })
        expect(getContent(meta, 'description')).toBeUndefined()
        expect(getContent(meta, 'og:description')).toBeUndefined()
    })

    it('uses the default image if the page has none', () => {
        const { meta } = getMetaInfo({ type: 'website', path: '/', title: 'programmier.bar' })
        expect(getContent(meta, 'og:image')).toBe(`${WEBSITE_URL}${DEFAULT_OG_IMAGE.path}`)
        expect(getContent(meta, 'og:image:width')).toBe('1200')
        expect(getContent(meta, 'og:image:height')).toBe('630')
        expect(getContent(meta, 'og:image:type')).toBe('image/png')
        expect(getContent(meta, 'og:image:alt')).toBe(DEFAULT_OG_IMAGE.alt)
        expect(getContent(meta, 'twitter:image')).toBe(`${WEBSITE_URL}${DEFAULT_OG_IMAGE.path}`)
        expect(getContent(meta, 'twitter:card')).toBe('summary_large_image')
    })

    it('scales page images to 1200px wide, keeping the aspect ratio', () => {
        const { meta } = getMetaInfo({ type: 'podcast', path: '/podcast/x', title: 'Deep Dive 123', image: cover })
        const url = new URL(getContent(meta, 'og:image')!)
        expect(url.pathname).toBe('/assets/cover-id')
        expect(url.searchParams.get('width')).toBe('1200')
        expect(url.searchParams.get('height')).toBe('1200')
        expect(getContent(meta, 'og:image:width')).toBe('1200')
        expect(getContent(meta, 'og:image:height')).toBe('1200')
        expect(getContent(meta, 'og:image:type')).toBe('image/jpeg')
        expect(getContent(meta, 'twitter:image')).toBe(url.toString())

        const landscape = { ...cover, width: 3000, height: 1500 }
        const landscapeMeta = getMetaInfo({ type: 'website', path: '/x', title: 'X', image: landscape }).meta
        expect(getContent(landscapeMeta, 'og:image:width')).toBe('1200')
        expect(getContent(landscapeMeta, 'og:image:height')).toBe('600')
    })

    it('does not upscale small images', () => {
        const small = { ...cover, width: 800, height: 400 }
        const { meta } = getMetaInfo({ type: 'website', path: '/x', title: 'X', image: small })
        expect(getContent(meta, 'og:image:width')).toBe('800')
        expect(getContent(meta, 'og:image:height')).toBe('400')
    })

    it('describes page images with the page title instead of the file title', () => {
        const { meta } = getMetaInfo({ type: 'podcast', path: '/podcast/x', title: 'Deep Dive 123', image: cover })
        expect(getContent(meta, 'og:image:alt')).toBe('Deep Dive 123')
        expect(getContent(meta, 'twitter:image:alt')).toBe('Deep Dive 123')
    })

    it('uses an external image without dimensions if there is no page image', () => {
        const externalImageUrl = 'https://example.com/og.png'
        const { meta } = getMetaInfo({ type: 'article', path: '/news/x', title: 'X', externalImageUrl })
        expect(getContent(meta, 'og:image')).toBe(externalImageUrl)
        expect(getContent(meta, 'og:image:width')).toBeUndefined()
        expect(getContent(meta, 'og:image:type')).toBeUndefined()

        const withImage = getMetaInfo({ type: 'article', path: '/x', title: 'X', image: cover, externalImageUrl })
        expect(getContent(withImage.meta, 'og:image')).toContain('/assets/cover-id')
    })

    it('ignores external images that are not absolute URLs', () => {
        const { meta } = getMetaInfo({ type: 'article', path: '/x', title: 'X', externalImageUrl: '/relative.png' })
        expect(getContent(meta, 'og:image')).toBe(`${WEBSITE_URL}${DEFAULT_OG_IMAGE.path}`)
    })

    it('emits Twitter tags with the name attribute and no player card', () => {
        const { meta } = getMetaInfo({
            type: 'podcast',
            path: '/podcast/x',
            title: 'X',
            image: cover,
            audioUrl: 'https://www.buzzsprout.com/1/2.mp3',
        })
        const twitterTags = meta.filter((tag) => ('name' in tag ? tag.name : tag.property).startsWith('twitter:'))
        expect(twitterTags.every((tag) => 'name' in tag)).toBe(true)
        expect(twitterTags.some((tag) => 'name' in tag && tag.name.startsWith('twitter:player'))).toBe(false)
        expect(getContent(meta, 'twitter:card')).toBe('summary_large_image')
        expect(getContent(meta, 'og:audio')).toMatch(/\/https:\/\/www\.buzzsprout\.com\/1\/2\.mp3$/)
    })

    it('adds the published time only to articles and podcasts', () => {
        const article = getMetaInfo({ type: 'article', path: '/x', title: 'X', publishedAt: '2026-09-25' })
        expect(getContent(article.meta, 'article:published_time')).toBe('2026-09-25')
        const website = getMetaInfo({ type: 'website', path: '/x', title: 'X', publishedAt: '2026-09-25' })
        expect(getContent(website.meta, 'article:published_time')).toBeUndefined()
    })

    it('uses the profile namespace for names', () => {
        const { meta } = getMetaInfo({
            type: 'profile',
            path: '/x',
            title: 'X',
            firstName: 'Erika',
            lastName: 'Muster',
        })
        expect(getContent(meta, 'profile:first_name')).toBe('Erika')
        expect(getContent(meta, 'profile:last_name')).toBe('Muster')
    })

    it('adds noindex only if requested', () => {
        expect(getContent(getMetaInfo({ type: 'website', path: '/x', title: 'X' }).meta, 'robots')).toBeUndefined()
        expect(getContent(getMetaInfo({ type: 'website', path: '/x', title: 'X', noIndex: true }).meta, 'robots')).toBe(
            'noindex, nofollow'
        )
    })
})
