import { describe, expect, test } from '@jest/globals'
import type { CascadeRelation } from './../util/cascadePublish.ts'
import { buildRelationFields, extractDraftIds, extractParentKeys, isPublishPayload } from './../util/cascadePublish.ts'

const M2M_RELATION: CascadeRelation = {
    relationField: 'speakers',
    childField: 'speaker',
    targetCollection: 'speakers',
}

const O2M_RELATION: CascadeRelation = {
    relationField: 'picks_of_the_day',
    targetCollection: 'picks_of_the_day',
}

describe('isPublishPayload', () => {
    test('should return true when status is published', () => {
        expect(isPublishPayload({ status: 'published' })).toBe(true)
    })

    test('should return false when status is draft', () => {
        expect(isPublishPayload({ status: 'draft' })).toBe(false)
    })

    test('should return false when status is missing', () => {
        expect(isPublishPayload({ title: 'No status here' })).toBe(false)
    })

    test('should return false for an undefined payload', () => {
        expect(isPublishPayload(undefined)).toBe(false)
    })
})

describe('extractParentKeys', () => {
    test('should return keys array when present (update action)', () => {
        expect(extractParentKeys({ keys: ['1', '2'] })).toEqual(['1', '2'])
    })

    test('should wrap a single key in an array (create action)', () => {
        expect(extractParentKeys({ key: '42' })).toEqual(['42'])
    })

    test('should prefer keys over key when both are present', () => {
        expect(extractParentKeys({ keys: ['1', '2'], key: '3' })).toEqual(['1', '2'])
    })

    test('should return an empty array when neither key nor keys is present', () => {
        expect(extractParentKeys({})).toEqual([])
    })
})

describe('buildRelationFields', () => {
    test('should build nested id/status fields for m2m relations via childField', () => {
        expect(buildRelationFields([M2M_RELATION])).toEqual(['speakers.speaker.id', 'speakers.speaker.status'])
    })

    test('should build direct id/status fields for o2m relations', () => {
        expect(buildRelationFields([O2M_RELATION])).toEqual(['picks_of_the_day.id', 'picks_of_the_day.status'])
    })

    test('should combine fields for multiple relations', () => {
        expect(buildRelationFields([M2M_RELATION, O2M_RELATION])).toEqual([
            'speakers.speaker.id',
            'speakers.speaker.status',
            'picks_of_the_day.id',
            'picks_of_the_day.status',
        ])
    })

    test('should return an empty array for no relations', () => {
        expect(buildRelationFields([])).toEqual([])
    })
})

describe('extractDraftIds', () => {
    test('should unwrap m2m junction records and return only draft child ids', () => {
        const parentItem = {
            speakers: [
                { speaker: { id: 's1', status: 'draft' } },
                { speaker: { id: 's2', status: 'published' } },
                { speaker: { id: 's3', status: 'draft' } },
            ],
        }

        expect(extractDraftIds(parentItem, M2M_RELATION)).toEqual(['s1', 's3'])
    })

    test('should return o2m draft ids directly', () => {
        const parentItem = {
            picks_of_the_day: [
                { id: 'p1', status: 'draft' },
                { id: 'p2', status: 'published' },
            ],
        }

        expect(extractDraftIds(parentItem, O2M_RELATION)).toEqual(['p1'])
    })

    test('should return an empty array when the relation field is missing', () => {
        expect(extractDraftIds({}, M2M_RELATION)).toEqual([])
    })

    test('should return an empty array when the relation is empty', () => {
        expect(extractDraftIds({ speakers: [] }, M2M_RELATION)).toEqual([])
    })

    test('should return an empty array when no child items are drafts', () => {
        const parentItem = {
            speakers: [{ speaker: { id: 's1', status: 'published' } }],
        }

        expect(extractDraftIds(parentItem, M2M_RELATION)).toEqual([])
    })

    test('should skip junction records with a missing child item', () => {
        const parentItem = {
            speakers: [{ speaker: null }, { speaker: { id: 's2', status: 'draft' } }],
        }

        expect(extractDraftIds(parentItem, M2M_RELATION)).toEqual(['s2'])
    })

    test('should skip draft items without an id', () => {
        const parentItem = {
            picks_of_the_day: [{ status: 'draft' }, { id: 'p2', status: 'draft' }],
        }

        expect(extractDraftIds(parentItem, O2M_RELATION)).toEqual(['p2'])
    })

    test('should not treat a non-array relation value as related items', () => {
        expect(extractDraftIds({ speakers: 'unexpected' }, M2M_RELATION)).toEqual([])
    })
})
