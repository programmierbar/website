import { beforeEach, describe, expect, it, vi } from 'vitest'
import availabilityHandler from '../server/api/tickets/availability.get'

// Nuxt/Nitro auto-imports must exist before the handler is imported (its
// `defineEventHandler(...)` runs at load time); vi.hoisted runs first.
const directus = vi.hoisted(() => {
    const directus = {
        getConference: vi.fn(),
        countPaidTicketsForConference: vi.fn(),
    }
    const g = globalThis as any
    g.defineEventHandler = (fn: any) => fn
    g.getQuery = (event: any) => event.query ?? {}
    g.createError = (input: any) => Object.assign(new Error(input.message), input)
    g.useAuthenticatedDirectus = () => directus
    return directus
})

const CONFERENCE_ID = 'f05b413b-0000-4000-8000-000000000001'
const availability = (conferenceId: unknown) => (availabilityHandler as any)({ query: { conferenceId } })

describe('GET /api/tickets/availability', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('is sold out once public tickets reach the limit', async () => {
        directus.getConference.mockResolvedValue({ id: CONFERENCE_ID, ticket_max_quantity: 120 })
        directus.countPaidTicketsForConference.mockResolvedValue(120)
        await expect(availability(CONFERENCE_ID)).resolves.toEqual({ soldOut: true })
    })

    it('is not sold out while tickets are left', async () => {
        directus.getConference.mockResolvedValue({ id: CONFERENCE_ID, ticket_max_quantity: 120 })
        directus.countPaidTicketsForConference.mockResolvedValue(119)
        await expect(availability(CONFERENCE_ID)).resolves.toEqual({ soldOut: false })
    })

    it('never sells out a conference without a limit', async () => {
        directus.getConference.mockResolvedValue({ id: CONFERENCE_ID, ticket_max_quantity: null })
        await expect(availability(CONFERENCE_ID)).resolves.toEqual({ soldOut: false })
        expect(directus.countPaidTicketsForConference).not.toHaveBeenCalled()
    })

    it('rejects a missing or malformed conference id', async () => {
        await expect(availability(undefined)).rejects.toMatchObject({ statusCode: 400 })
        await expect(availability('not-a-uuid')).rejects.toMatchObject({ statusCode: 400 })
    })

    it('answers 404 for an unknown conference', async () => {
        directus.getConference.mockRejectedValue({ response: { status: 404 } })
        await expect(availability(CONFERENCE_ID)).rejects.toMatchObject({ statusCode: 404 })
    })
})
