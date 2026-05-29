import type { H3Event } from 'h3'
import { getOS } from '~/helpers'
import {
    CFP_FORM_URL,
    CONFERENCE_LANDING_URL,
    CONFERENCE_VANITY_HOSTS,
    DISCORD_INVITE_LINK,
    FLUTTERDAY_LANDING_URL,
    PROGRAMMIER_CON_APP_ANDROID,
    PROGRAMMIER_CON_APP_IOS,
    WEBFINGER_HOST,
} from '~/config'

/**
 * Request path prefixes that must never be caught by a host-wide catch-all
 * redirect.
 *
 * These requests are issued by the already-loaded SPA against the current
 * origin (e.g. `$fetch('/api/tickets/validate-discount')`, `/_nuxt/...`
 * assets). 302-ing them to the apex returns an HTML page where JSON / an
 * asset is expected and silently breaks the calling feature — this is exactly
 * how discount-code validation broke on the conference subdomains. Real page
 * navigations do not start with these prefixes and are unaffected.
 */
const NON_PAGE_PREFIXES = ['/api/', '/_'] as const

function isNonPageRequest(path: string): boolean {
    return NON_PAGE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

function hostStartsWithAny(host: string, prefixes: readonly string[]): boolean {
    return prefixes.some((prefix) => host.startsWith(prefix))
}

/**
 * Vanity domains that redirect *every* page request to a fixed destination.
 * These are guarded against non-page requests (see {@link resolveRedirect}).
 */
const VANITY_HOST_REDIRECTS: ReadonlyArray<{ hosts: readonly string[]; destination: string }> = [
    { hosts: ['cfp.programmier.bar'], destination: CFP_FORM_URL },
    { hosts: CONFERENCE_VANITY_HOSTS, destination: CONFERENCE_LANDING_URL },
    { hosts: ['flutterday.programmier.bar'], destination: FLUTTERDAY_LANDING_URL },
    { hosts: ['discord.programmier.bar'], destination: DISCORD_INVITE_LINK },
]

/**
 * Resolve the redirect target for an incoming request, or `null` when no
 * redirect applies.
 *
 * Precise path-based redirects are evaluated first because they target an
 * explicit path and are safe on any host. Host-wide catch-all redirects run
 * last and skip non-page requests, so SPA `$fetch` and asset calls are never
 * turned into a 302 to the apex.
 */
export function resolveRedirect(event: H3Event): string | null {
    const host = event.headers.get('host') || ''
    const path = event.path

    // 1. Webfinger → federated social instance. The incoming path is preserved.
    if (path.startsWith('/.well-known/webfinger')) {
        return `${WEBFINGER_HOST}${path}`
    }

    // 2. Conference "/app" deep link → native app store, chosen by OS.
    if (path === '/app' && hostStartsWithAny(host, CONFERENCE_VANITY_HOSTS)) {
        const os = getOS(event.headers.get('user-agent') || '')
        return os === 'iOS' || os === 'macOS' ? PROGRAMMIER_CON_APP_IOS : PROGRAMMIER_CON_APP_ANDROID
    }

    // 3. "/discord" shortcut works on any host.
    if (path === '/discord') {
        return DISCORD_INVITE_LINK
    }

    // 4. Vanity-host catch-alls. Never touch API / internal / asset requests —
    //    see NON_PAGE_PREFIXES for why.
    if (isNonPageRequest(path)) {
        return null
    }

    for (const rule of VANITY_HOST_REDIRECTS) {
        if (hostStartsWithAny(host, rule.hosts)) {
            return rule.destination
        }
    }

    return null
}
