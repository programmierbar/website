import { computed } from 'vue'

/**
 * Whether the public tickets of a conference are sold out. Loaded during SSR,
 * so the ISR-cached conference page renders the right state without flicker,
 * while the per-request ticket page is always current. Pass no id to skip the
 * request (e.g. when the page shows no ticket section).
 *
 * This only drives what visitors see: the checkout route enforces the ticket
 * limit on its own. If the lookup fails, tickets are shown as available and
 * checkout stays the authority.
 */
export async function useTicketAvailability(conferenceId: string | undefined) {
    const { data, error } = await useFetch('/api/tickets/availability', {
        key: `ticket-availability:${conferenceId ?? 'none'}`,
        query: { conferenceId },
        immediate: Boolean(conferenceId),
        watch: false,
    })

    if (error.value) {
        console.error(`Ticket availability for conference ${conferenceId} could not be loaded:`, error.value)
    }

    return computed(() => data.value?.soldOut === true)
}
