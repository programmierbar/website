import { randomUUID } from 'node:crypto'

/**
 * Helpers for the speaker portal links, shared by everything that issues or mails one: the
 * `speaker-token` hook (new speakers), the `speaker-portal-notifications` hook (invitation and
 * reminders) and the `speaker-portal` endpoint (profile-update requests).
 */

/** How long a portal link stays usable after it was issued. */
export const PORTAL_TOKEN_VALIDITY_DAYS = 14

/** A fresh single-use portal token and its expiry, as written to the speaker. */
export function createPortalToken(now: Date = new Date()): { portal_token: string; portal_token_expires: string } {
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + PORTAL_TOKEN_VALIDITY_DAYS)

    return {
        portal_token: randomUUID(),
        portal_token_expires: expiresAt.toISOString(),
    }
}

function trimTrailingSlashes(url: string): string {
    return url.replace(/\/+$/, '')
}

/** The link to the speaker portal form for a token. */
export function buildPortalUrl(websiteUrl: string, token: string): string {
    return `${trimTrailingSlashes(websiteUrl)}/speaker-portal?token=${encodeURIComponent(token)}`
}

/** The speaker's public profile in the Hall of Fame. */
export function buildPublicProfileUrl(websiteUrl: string, slug: string): string {
    return `${trimTrailingSlashes(websiteUrl)}/hall-of-fame/${encodeURIComponent(slug)}`
}
