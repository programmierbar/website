/**
 * Check if we're currently in the early bird period
 */
export function isEarlyBirdPeriod(deadline: string | null): boolean {
    if (!deadline) return false
    return new Date() <= new Date(deadline)
}
