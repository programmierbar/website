import { describe, expect, it, vi } from 'vitest'
import {
    canCheckInTickets,
    CheckinError,
    checkInTicket,
    loadCheckinConference,
    loadCheckinCounts,
    withSessionRetry,
    type CheckinRequest,
} from '../helpers/ticketCheckin'

const CONFERENCE_ID = 'f05b413b-3d5e-48d9-9601-2e02266a628c'

type Call = { path: string; method: string; params: any; body: any }

function directusError(status: number) {
    return { errors: [{ message: `status ${status}` }], response: { status } }
}

/** Fake request: resolves each SDK command with `respond(call)` and records the calls. */
function fakeRequest(respond: (call: Call) => unknown) {
    const calls: Call[] = []
    const request: CheckinRequest = async (command: any) => {
        const { path, method, params, body } = command()
        const call = { path, method, params, body: body ? JSON.parse(body) : undefined }
        calls.push(call)
        return respond(call) as any
    }
    return { request, calls }
}

function ticket(overrides: Record<string, unknown> = {}) {
    return {
        id: 't1',
        conference: CONFERENCE_ID,
        attendee_first_name: 'Ada',
        attendee_last_name: 'Lovelace',
        status: 'paid',
        checked_in_at: null,
        tshirt_size: 'L',
        date_created: '2026-08-01T10:00:00.000Z',
        ...overrides,
    }
}

describe('withSessionRetry', () => {
    it('passes successful requests through without refreshing', async () => {
        const refresh = vi.fn()
        const request = withSessionRetry(async () => 'ok' as any, refresh)
        await expect(request((() => ({})) as any)).resolves.toBe('ok')
        expect(refresh).not.toHaveBeenCalled()
    })

    it.each([401, 403])('refreshes the session and retries once after a %i', async (status) => {
        const raw = vi.fn().mockRejectedValueOnce(directusError(status)).mockResolvedValueOnce('ok')
        const refresh = vi.fn().mockResolvedValue(undefined)
        const request = withSessionRetry(raw, refresh)
        await expect(request((() => ({})) as any)).resolves.toBe('ok')
        expect(refresh).toHaveBeenCalledTimes(1)
        expect(raw).toHaveBeenCalledTimes(2)
    })

    it('reports an auth failure when the retry is rejected too', async () => {
        const raw = vi.fn().mockRejectedValue(directusError(401))
        const request = withSessionRetry(raw, vi.fn().mockResolvedValue(undefined))
        await expect(request((() => ({})) as any)).rejects.toMatchObject({ name: 'CheckinError', reason: 'auth' })
        expect(raw).toHaveBeenCalledTimes(2)
    })

    it('reports an auth failure when the session cannot be refreshed', async () => {
        const raw = vi.fn().mockRejectedValue(directusError(403))
        const request = withSessionRetry(raw, vi.fn().mockRejectedValue(directusError(400)))
        await expect(request((() => ({})) as any)).rejects.toMatchObject({ reason: 'auth' })
        expect(raw).toHaveBeenCalledTimes(1)
    })

    it('does not retry other errors', async () => {
        const refresh = vi.fn()
        const request = withSessionRetry(vi.fn().mockRejectedValue(directusError(500)), refresh)
        await expect(request((() => ({})) as any)).rejects.toEqual(directusError(500))
        expect(refresh).not.toHaveBeenCalled()
    })
})

describe('checkInTicket', () => {
    const now = () => new Date('2026-11-25T08:00:00.000Z')

    it('checks a paid ticket in and returns the T-shirt', async () => {
        const { request, calls } = fakeRequest((call) => (call.method === 'GET' ? [ticket()] : {}))

        await expect(checkInTicket(request, CONFERENCE_ID, 'TKT-ABC', now)).resolves.toEqual({
            alreadyCheckedIn: false,
            firstName: 'Ada',
            lastName: 'Lovelace',
            tshirt: { status: 'eligible', size: 'L' },
        })
        expect(calls[0]).toMatchObject({ path: '/items/tickets', method: 'GET' })
        expect(calls[0]!.params.filter).toEqual({ ticket_code: { _eq: 'TKT-ABC' } })
        expect(calls[1]).toMatchObject({
            path: '/items/tickets/t1',
            method: 'PATCH',
            body: { status: 'checked_in', checked_in_at: '2026-11-25T08:00:00.000Z' },
        })
    })

    it('does not update a ticket that is already checked in', async () => {
        const checkedInAt = '2026-11-25T07:30:00.000Z'
        const { request, calls } = fakeRequest(() => [
            ticket({ status: 'checked_in', checked_in_at: checkedInAt, date_created: '2026-10-10T10:00:00.000Z' }),
        ])

        await expect(checkInTicket(request, CONFERENCE_ID, 'TKT-ABC', now)).resolves.toEqual({
            alreadyCheckedIn: true,
            checkedInAt,
            firstName: 'Ada',
            lastName: 'Lovelace',
            tshirt: { status: 'too_late', size: 'L' },
        })
        expect(calls).toHaveLength(1)
    })

    it.each([
        ['not_found', []],
        ['wrong_conference', [ticket({ conference: 'other' })]],
        ['cancelled', [ticket({ status: 'cancelled' })]],
    ])('rejects with %s without updating', async (reason, tickets) => {
        const { request, calls } = fakeRequest(() => tickets)
        const result = checkInTicket(request, CONFERENCE_ID, 'TKT-ABC', now)
        await expect(result).rejects.toBeInstanceOf(CheckinError)
        await expect(result).rejects.toMatchObject({ reason })
        expect(calls).toHaveLength(1)
    })
})

describe('loadCheckinConference', () => {
    it('reads the latest conference with ticketing', async () => {
        const conference = { id: CONFERENCE_ID, title: 'programmier.con 2026', slug: 'programmiercon-2026' }
        const { request, calls } = fakeRequest(() => [conference])

        await expect(loadCheckinConference(request)).resolves.toEqual(conference)
        expect(calls[0]).toMatchObject({ path: '/items/conferences', method: 'GET' })
    })

    it('fails clearly when no conference has ticketing', async () => {
        const { request } = fakeRequest(() => [])
        await expect(loadCheckinConference(request)).rejects.toMatchObject({ reason: 'no_conference' })
    })
})

describe('loadCheckinCounts', () => {
    it('counts sold and checked-in tickets of the conference', async () => {
        const { request, calls } = fakeRequest((call) => [
            { count: { id: JSON.stringify(call.params).includes('checked_in') ? '12' : '340' } },
        ])

        await expect(loadCheckinCounts(request, CONFERENCE_ID)).resolves.toEqual({ totalSold: 340, checkedIn: 12 })
        expect(calls).toHaveLength(2)
        expect(calls.every((call) => JSON.stringify(call.params).includes(CONFERENCE_ID))).toBe(true)
    })
})

describe('canCheckInTickets', () => {
    const access = (read: object, update: object) => ({ tickets: { read, update } })

    it.each([
        ['admins', access({ access: 'full', fields: ['*'] }, { access: 'full', fields: ['*'] }), true],
        [
            'roles that may set status and checked_in_at',
            access({ access: 'partial', fields: ['id'] }, { access: 'full', fields: ['status', 'checked_in_at'] }),
            true,
        ],
        ['roles without update access', access({ access: 'full', fields: ['*'] }, { access: 'none' }), false],
        [
            'roles that may not set checked_in_at',
            access({ access: 'full', fields: ['*'] }, { access: 'full', fields: ['status'] }),
            false,
        ],
        ['roles without read access', access({ access: 'none' }, { access: 'full', fields: ['*'] }), false],
        ['roles without any ticket permission', {}, false],
    ])('answers for %s', async (_, permissions, expected) => {
        const { request, calls } = fakeRequest(() => permissions)
        await expect(canCheckInTickets(request)).resolves.toBe(expected)
        expect(calls[0]).toMatchObject({ path: '/permissions/me', method: 'GET' })
    })
})
