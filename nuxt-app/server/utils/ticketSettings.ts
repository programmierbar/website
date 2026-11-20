import type { useAuthenticatedDirectus } from './authenticatedDirectus'

/**
 * Check if we're currently in the early bird period
 */
export function isEarlyBirdPeriod(deadline: string | null): boolean {
    if (!deadline) return false
    return new Date() <= new Date(deadline)
}

/**
 * Tickets still available for public sale, or null when the conference has no
 * cap. Internal (team) tickets don't consume capacity, so they are not counted.
 * The checkout route and the availability route both decide from this.
 */
export async function getRemainingTicketCapacity(
    directus: ReturnType<typeof useAuthenticatedDirectus>,
    conference: { id: string; ticket_max_quantity: number | null }
): Promise<number | null> {
    if (conference.ticket_max_quantity === null) return null
    const sold = await directus.countPaidTicketsForConference(conference.id)
    return Math.max(0, conference.ticket_max_quantity - sold)
}
