/**
 * Which capacity milestone a new registration reached, if any: 80 % or full.
 * Exact matches only, so each milestone is reported once — registrations are
 * serialized per meetup, so the count passes each value exactly once (a
 * cancellation and a new registration can repeat one, which is harmless).
 *
 * @param publicCount Confirmed, non-internal registrations after the insert.
 * @param limit `meetups.registration_limit`; `null` = unlimited, never reports.
 */
export function getCapacityMilestone(publicCount: number, limit: number | null | undefined): 80 | 100 | null {
    if (typeof limit !== 'number' || limit <= 0) {
        return null
    }
    if (publicCount === limit) {
        return 100
    }
    // Below 5 spots the 80 % mark would be a ping for every other registration.
    if (limit >= 5 && publicCount === Math.ceil(limit * 0.8)) {
        return 80
    }
    return null
}
