import { aggregate, readItems, readUserPermissions, updateItem, type RestCommand } from '@directus/sdk'
import { CONFERENCE_TSHIRT_ORDER_DEADLINES } from '../config'
import type { CheckinConference, CheckinCounts, CheckinResult } from '../types/directus'
import { getCheckinTshirt } from './checkinTshirt'

// The check-in page talks to Directus directly, with the Directus session cookie of
// admin.programmier.bar (`credentials: 'include'`). That cookie belongs to the admin domain, so a
// route on www.programmier.bar never receives it and cannot tell who is scanning. Running the
// check-in with the same session the page's login check uses keeps both in agreement, and
// Directus permissions decide who may check tickets in.

export type CheckinRequest = <Output>(command: RestCommand<Output, any>) => Promise<Output>

export type CheckinErrorReason = 'auth' | 'not_found' | 'cancelled' | 'wrong_conference' | 'no_conference'

export class CheckinError extends Error {
    constructor(
        readonly reason: CheckinErrorReason,
        message: string
    ) {
        super(message)
        this.name = 'CheckinError'
    }
}

/** HTTP status of a failed `@directus/sdk` request, which rejects with `{ errors, response }`. */
export function getDirectusErrorStatus(error: unknown): number | undefined {
    const status = (error as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === 'number' ? status : undefined
}

// Directus answers 401 for an expired or invalid session and 403 when the request arrives without
// one (the public role may not read tickets) or the role lacks the permission.
function isAuthFailure(error: unknown) {
    const status = getDirectusErrorStatus(error)
    return status === 401 || status === 403
}

/**
 * Wraps a Directus request function so that an auth failure refreshes the session and retries
 * the request once. A failure that persists becomes a `CheckinError` with reason `auth`.
 */
export function withSessionRetry(request: CheckinRequest, refresh: () => Promise<unknown>): CheckinRequest {
    return async (command) => {
        try {
            return await request(command)
        } catch (error) {
            if (!isAuthFailure(error)) throw error
        }

        const authError = new CheckinError('auth', 'Nicht eingeloggt oder keine Berechtigung')
        try {
            await refresh()
        } catch {
            throw authError
        }

        try {
            return await request(command)
        } catch (error) {
            throw isAuthFailure(error) ? authError : error
        }
    }
}

export async function loadCheckinConference(request: CheckinRequest): Promise<CheckinConference> {
    const conferences = (await request(
        readItems('conferences' as any, {
            filter: { ticketing_enabled: { _eq: true } },
            fields: ['id', 'title', 'slug'],
            sort: ['-start_on'],
            limit: 1,
        })
    )) as CheckinConference[]

    const conference = conferences?.[0]
    if (!conference) throw new CheckinError('no_conference', 'Keine Konferenz mit Ticketing gefunden')
    return conference
}

async function countTickets(request: CheckinRequest, filter: Record<string, unknown>) {
    const result = (await request(
        aggregate('tickets' as any, {
            aggregate: { count: ['id'] },
            query: { filter: { ...filter, is_internal: { _neq: true } } },
        })
    )) as { count?: { id?: number | string } }[]
    return Number(result?.[0]?.count?.id ?? 0)
}

/** The counter above the scanner. Optional: check-in works without it. */
export async function loadCheckinCounts(request: CheckinRequest, conferenceId: string): Promise<CheckinCounts> {
    const [totalSold, checkedIn] = await Promise.all([
        countTickets(request, { conference: { _eq: conferenceId }, status: { _neq: 'cancelled' } }),
        countTickets(request, { conference: { _eq: conferenceId }, status: { _eq: 'checked_in' } }),
    ])
    return { totalSold, checkedIn }
}

const CHECKIN_UPDATE_FIELDS = ['status', 'checked_in_at']

type CollectionAccess = { access?: 'none' | 'partial' | 'full'; fields?: string[] }

/**
 * Whether the signed-in user's Directus permissions (`GET /permissions/me`) let them read tickets
 * and set `status` and `checked_in_at`. Admins get full access on every collection.
 */
export async function canCheckInTickets(request: CheckinRequest): Promise<boolean> {
    const permissions = (await request(readUserPermissions())) as Record<
        string,
        Partial<Record<'read' | 'update', CollectionAccess>> | undefined
    >
    const tickets = permissions?.tickets
    const has = (info: CollectionAccess | undefined, fields: string[]) =>
        !!info?.access &&
        info.access !== 'none' &&
        (info.fields?.includes('*') || fields.every((field) => info.fields?.includes(field)))

    return has(tickets?.read, []) && has(tickets?.update, CHECKIN_UPDATE_FIELDS)
}

type CheckinTicket = {
    id: string
    conference: string | null
    attendee_first_name: string
    attendee_last_name: string
    status: string
    checked_in_at: string | null
    tshirt_size: string | null
    date_created: string | null
}

export async function checkInTicket(
    request: CheckinRequest,
    conferenceId: string,
    ticketCode: string,
    now: () => Date = () => new Date()
): Promise<CheckinResult> {
    const tickets = (await request(
        readItems('tickets' as any, {
            filter: { ticket_code: { _eq: ticketCode } },
            fields: [
                'id',
                'conference',
                'attendee_first_name',
                'attendee_last_name',
                'status',
                'checked_in_at',
                'tshirt_size',
                'date_created',
            ],
            limit: 1,
        })
    )) as CheckinTicket[]

    const ticket = tickets?.[0]
    if (!ticket) throw new CheckinError('not_found', 'Ticket nicht gefunden')
    if (ticket.conference !== conferenceId) {
        throw new CheckinError('wrong_conference', 'Ticket gehört zu einer anderen Konferenz')
    }
    if (ticket.status === 'cancelled') throw new CheckinError('cancelled', 'Ticket wurde storniert')

    const tshirt = getCheckinTshirt(
        ticket.tshirt_size,
        ticket.date_created,
        CONFERENCE_TSHIRT_ORDER_DEADLINES[conferenceId]
    )
    const attendee = { firstName: ticket.attendee_first_name, lastName: ticket.attendee_last_name, tshirt }

    if (ticket.status === 'checked_in') {
        return { alreadyCheckedIn: true, checkedInAt: ticket.checked_in_at, ...attendee }
    }

    await request(
        updateItem('tickets' as any, ticket.id, {
            status: 'checked_in',
            checked_in_at: now().toISOString(),
        })
    )

    return { alreadyCheckedIn: false, ...attendee }
}
