import type { DirectusTicketSettingsItem } from '~/types/tickets'

let cachedSettings: DirectusTicketSettingsItem | null = null
let cacheTime: number = 0
const CACHE_TTL = 60 * 1000 // 1 minute cache

/**
 * Fetch ticket settings from Directus (singleton collection)
 * Uses a short-lived cache to avoid repeated requests
 */
export async function getTicketSettings(): Promise<DirectusTicketSettingsItem | null> {
    const now = Date.now()

    // Return cached settings if still valid
    if (cachedSettings && now - cacheTime < CACHE_TTL) {
        return cachedSettings
    }

    const config = useRuntimeConfig()
    const directusUrl = config.public.directusCmsUrl || 'http://localhost:8055'
    const adminToken = config.directusAdminToken

    if (!adminToken) {
        console.error('NUXT_DIRECTUS_ADMIN_TOKEN environment variable is not configured')
        return null
    }

    try {
        const response = await fetch(
            `${directusUrl}/items/ticket_settings?fields=early_bird_price_cents,regular_price_cents,discounted_price_cents,early_bird_deadline,discount_code`,
            {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            }
        )

        if (!response.ok) {
            const errorText = await response.text().catch(() => '')
            console.error(`Failed to fetch ticket settings: ${response.status} ${response.statusText}`, errorText)
            if (response.status === 401) {
                console.error('Check that NUXT_DIRECTUS_ADMIN_TOKEN is set to a valid Directus access token')
            }
            return null
        }

        const data = await response.json()
        cachedSettings = data.data as DirectusTicketSettingsItem
        cacheTime = now
        return cachedSettings
    } catch (e) {
        console.error('Error fetching ticket settings:', e)
        return null
    }
}

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
