import { describe, expect, jest, test } from '@jest/globals'
import { isContentVersion, ISSUE_FIELDS, loadNewsletterIssue } from '../loadIssue.ts'

describe('isContentVersion', () => {
    test.each([undefined, null, '', '  ', 'main', ['a']])('%j is the live item', (value) => {
        expect(isContentVersion(value)).toBe(false)
    })

    test('a version key is a Content Version', () => {
        expect(isContentVersion('entwurf')).toBe(true)
    })
})

describe('loadNewsletterIssue', () => {
    test('reads the issue with its M2A blocks and nested podcasts/meetups', async () => {
        const readOne = jest.fn(async () => ({ subject: 's' }))
        await loadNewsletterIssue({ readOne }, 'id-1')

        expect(readOne).toHaveBeenCalledWith('id-1', { fields: ISSUE_FIELDS, deep: { blocks: { _limit: -1 } } })
        expect(ISSUE_FIELDS).toEqual(
            expect.arrayContaining([
                'blocks.sort',
                'blocks.collection',
                'blocks.item:newsletter_blocks_text.body',
                'blocks.item:newsletter_blocks_podcasts.podcasts.podcasts_id.slug',
                'blocks.item:newsletter_blocks_meetups.meetups.meetups_id.start_on',
            ])
        )
    })

    test('passes a Content Version through to the ItemsService query', async () => {
        const readOne = jest.fn(async () => ({}))
        await loadNewsletterIssue({ readOne }, 'id-1', 'entwurf')
        expect(readOne).toHaveBeenCalledWith('id-1', expect.objectContaining({ version: 'entwurf' }))
    })

    test('leaves the version out for main', async () => {
        const readOne = jest.fn(async (_id: string, _query: Record<string, unknown>) => ({}))
        await loadNewsletterIssue({ readOne }, 'id-1', 'main')
        expect(readOne.mock.calls[0]?.[1]).not.toHaveProperty('version')
    })
})
