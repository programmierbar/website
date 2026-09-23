import { describe, expect, jest, test } from '@jest/globals'
import { buildJunctionPayload, buildUniqueNewsSlug, extractKeys, SOURCE_COLLECTION } from './../newsTarget.ts'

describe('extractKeys', () => {
    test('wraps a single key into an array', () => {
        expect(extractKeys({ key: 'abc' })).toEqual(['abc'])
    })

    test('returns the keys array as-is', () => {
        expect(extractKeys({ keys: ['a', 'b'] })).toEqual(['a', 'b'])
    })

    test('prefers keys over key when both are present', () => {
        expect(extractKeys({ key: 'x', keys: ['a', 'b'] })).toEqual(['a', 'b'])
    })

    test('returns an empty array for missing or empty metadata', () => {
        expect(extractKeys(undefined)).toEqual([])
        expect(extractKeys({})).toEqual([])
        expect(extractKeys({ keys: [] })).toEqual([])
    })

    test('handles a numeric key', () => {
        expect(extractKeys({ key: 0 })).toEqual([0])
    })
})

describe('buildJunctionPayload', () => {
    test('builds the m2a junction row for a news_links source', () => {
        expect(buildJunctionPayload('news-1', 'link-1')).toEqual({
            news_id: 'news-1',
            collection: SOURCE_COLLECTION,
            target: 'link-1',
        })
    })

    test('stringifies a numeric source id', () => {
        expect(buildJunctionPayload('news-1', 42)).toEqual({
            news_id: 'news-1',
            collection: 'news_links',
            target: '42',
        })
    })
})

describe('buildUniqueNewsSlug', () => {
    const service = (rows: Array<Record<string, any>>) => ({ readByQuery: jest.fn(async () => rows) })

    test('returns null when there is no usable title', async () => {
        await expect(buildUniqueNewsSlug(service([]), '')).resolves.toBeNull()
        await expect(buildUniqueNewsSlug(service([]), null)).resolves.toBeNull()
        await expect(buildUniqueNewsSlug(service([]), undefined)).resolves.toBeNull()
    })

    test('returns the base slug when it is free', async () => {
        await expect(buildUniqueNewsSlug(service([]), 'React 19 Released')).resolves.toBe('react-19-released')
    })

    test('appends the next free numeric suffix on collision', async () => {
        const rows = [{ id: 'a', slug: 'react-19-released' }, { id: 'b', slug: 'react-19-released-2' }]
        await expect(buildUniqueNewsSlug(service(rows), 'React 19 Released')).resolves.toBe('react-19-released-3')
    })

    test('ignores the excluded id so an item does not collide with itself', async () => {
        const rows = [{ id: 'self', slug: 'react-19-released' }]
        await expect(buildUniqueNewsSlug(service(rows), 'React 19 Released', 'self')).resolves.toBe('react-19-released')
    })
})
