import type { DirectusTicketSettingsItem } from '~/types/directus'

/**
 * Check if we're currently in the early bird period
 */
export function isEarlyBirdPeriod(settings: DirectusTicketSettingsItem): boolean {
    const deadline = new Date(settings.early_bird_deadline)
    return new Date() <= deadline
}

/**
 * Get the current unit price based on ticket type
 */
export function getUnitPrice(
    settings: DirectusTicketSettingsItem,
    isEarlyBird: boolean,
    hasDiscount: boolean
): number {
    if (isEarlyBird) {
        return settings.early_bird_price_cents
    }
    if (hasDiscount) {
        return settings.discounted_price_cents
    }
    return settings.regular_price_cents
}
