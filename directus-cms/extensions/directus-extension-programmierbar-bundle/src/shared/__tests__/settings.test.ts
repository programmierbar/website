import { describe, expect, jest, test } from '@jest/globals'
import { getRequiredSetting } from '../settings.ts'

/**
 * Build a minimal SettingsContext whose `automation_settings` service
 * returns the given rows from readByQuery.
 */
function buildContext(rows: Array<{ value: any }>) {
    class ItemsService {
        async readByQuery() {
            return rows
        }
    }

    return {
        logger: { warn: jest.fn() },
        services: { ItemsService },
        getSchema: async () => ({}),
    } as any
}

describe('getRequiredSetting', () => {
    test('returns the value when the setting is present', async () => {
        await expect(getRequiredSetting('website_url', buildContext([{ value: 'https://staging.example' }]))).resolves.toBe(
            'https://staging.example'
        )
    })

    test('throws when the setting is missing', async () => {
        await expect(getRequiredSetting('website_url', buildContext([]))).rejects.toThrow(
            "Required setting 'website_url' is not configured"
        )
    })

    test('throws when the setting is blank', async () => {
        await expect(getRequiredSetting('website_url', buildContext([{ value: '   ' }]))).rejects.toThrow(
            "Required setting 'website_url' is not configured"
        )
    })
})
