import type { CheckinTshirtInfo } from '~/types/directus'

/**
 * What the check-in crew hands out. The size is still collected after the
 * deadline, so a late ticket can have one; it then shows as `too_late`.
 * `ticketCreatedAt` is the ticket's `date_created`, set when the order is paid.
 */
export function getCheckinTshirt(
    tshirtSize: string | null | undefined,
    ticketCreatedAt: string | null | undefined,
    deadline: string | undefined
): CheckinTshirtInfo {
    const size = tshirtSize || null
    const inTime = !deadline || (!!ticketCreatedAt && new Date(ticketCreatedAt) <= new Date(deadline))

    if (!inTime) return { status: 'too_late', size }
    if (!size) return { status: 'no_size' }
    return { status: 'eligible', size }
}
