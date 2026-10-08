import { getMeetupRegistrationState, isInternalEmail, normalizeEmail } from 'shared-code'
import { describe, expect, it } from 'vitest'
import { MeetupRegistrationSchema } from '../server/utils/schema'

const NOW = new Date('2026-10-07T12:00:00.000Z')
const open = {
    status: 'published',
    start_on: '2026-10-22T16:00:00.000Z',
    registration_enabled: true,
    registration_limit: 100,
}

describe('getMeetupRegistrationState', () => {
    it('is open with spots left', () => {
        expect(getMeetupRegistrationState(open, 37, NOW)).toEqual({ state: 'open', spotsLeft: 63 })
    })

    it('is full once the public count reaches the limit', () => {
        expect(getMeetupRegistrationState(open, 100, NOW)).toEqual({ state: 'full', spotsLeft: 0 })
        expect(getMeetupRegistrationState(open, 104, NOW)).toEqual({ state: 'full', spotsLeft: 0 })
    })

    it('treats a missing limit as unlimited', () => {
        expect(getMeetupRegistrationState({ ...open, registration_limit: null }, 5000, NOW)).toEqual({
            state: 'open',
            spotsLeft: null,
        })
    })

    it('closes at the start of the event', () => {
        expect(getMeetupRegistrationState({ ...open, start_on: NOW.toISOString() }, 0, NOW).state).toBe('closed')
    })

    it('is disabled when switched off or not published', () => {
        expect(getMeetupRegistrationState({ ...open, registration_enabled: false }, 0, NOW).state).toBe('disabled')
        expect(getMeetupRegistrationState({ ...open, registration_enabled: null }, 0, NOW).state).toBe('disabled')
        expect(getMeetupRegistrationState({ ...open, status: 'draft' }, 0, NOW).state).toBe('disabled')
    })
})

describe('internal addresses', () => {
    it('recognizes the company domain case-insensitively', () => {
        expect(isInternalEmail(' Erika.Mustermann@LOTUM.de ')).toBe(true)
        expect(isInternalEmail('erika@example.com')).toBe(false)
        expect(isInternalEmail('erika@notlotum.de')).toBe(false)
        expect(isInternalEmail('lotum.de@example.com')).toBe(false)
    })

    it('normalizes emails', () => {
        expect(normalizeEmail('  Erika@Example.COM ')).toBe('erika@example.com')
    })
})

describe('MeetupRegistrationSchema', () => {
    const base = {
        meetupId: 'a3a8b2c4-0000-4000-8000-000000000001',
        first_name: ' Erika ',
        last_name: ' Mustermann ',
        email: ' erika@example.com ',
    }

    it('accepts the minimal form and defaults the consent to false', () => {
        const result = MeetupRegistrationSchema.parse(base)
        expect(result).toMatchObject({ first_name: 'Erika', last_name: 'Mustermann', email: 'erika@example.com' })
        expect(result.wants_meetup_updates).toBe(false)
        expect(result.pronouns).toBeUndefined()
    })

    it('treats empty optional fields as not provided', () => {
        const result = MeetupRegistrationSchema.parse({ ...base, pronouns: '  ', job_title: '', heard_about_from: '' })
        expect(result.pronouns).toBeUndefined()
        expect(result.job_title).toBeUndefined()
        expect(result.heard_about_from).toBeUndefined()
    })

    it('keeps the free-text answer only for "Sonstiges"', () => {
        expect(
            MeetupRegistrationSchema.parse({ ...base, heard_about_from: 'other', heard_about_other: 'Kollegin' })
                .heard_about_other
        ).toBe('Kollegin')
        expect(
            MeetupRegistrationSchema.parse({ ...base, heard_about_from: 'podcast', heard_about_other: 'egal' })
                .heard_about_other
        ).toBeUndefined()
    })

    it('rejects unknown answers, missing names, bad emails and long pronouns', () => {
        expect(MeetupRegistrationSchema.safeParse({ ...base, heard_about_from: 'fax' }).success).toBe(false)
        expect(MeetupRegistrationSchema.safeParse({ ...base, first_name: ' ' }).success).toBe(false)
        expect(MeetupRegistrationSchema.safeParse({ ...base, last_name: '' }).success).toBe(false)
        expect(MeetupRegistrationSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
        expect(MeetupRegistrationSchema.safeParse({ ...base, pronouns: 'x'.repeat(51) }).success).toBe(false)
        expect(MeetupRegistrationSchema.safeParse({ ...base, meetupId: 'x' }).success).toBe(false)
    })
})
