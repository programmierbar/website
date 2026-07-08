import { describe, expect, test } from '@jest/globals'
import { buildJunctionPayload, DEFAULT_STATUS, extractKeys, resolveStatus, SOURCE_COLLECTION } from './../newsTarget.ts'

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

describe('resolveStatus', () => {
    test('prefers the payload status', () => {
        expect(resolveStatus({ status: 'published' }, { status: 'draft' })).toBe('published')
    })

    test('falls back to the source item status', () => {
        expect(resolveStatus({}, { status: 'archived' })).toBe('archived')
        expect(resolveStatus(undefined, { status: 'archived' })).toBe('archived')
    })

    test('defaults to draft when nothing is available', () => {
        expect(resolveStatus(undefined, null)).toBe(DEFAULT_STATUS)
        expect(resolveStatus({}, undefined)).toBe('draft')
    })
})
