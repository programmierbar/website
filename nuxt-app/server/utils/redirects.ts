import type { H3Event } from 'h3'
import { getOS } from '~/helpers'
import {
    CONFERENCE_VANITY_HOSTS,
    DISCORD_INVITE_LINK,
    PROGRAMMIER_CON_APP_ANDROID,
    PROGRAMMIER_CON_APP_IOS,
    WEBFINGER_HOST,
} from '~/config'

function hostStartsWithAny(host: string, prefixes: readonly string[]): boolean {
    return prefixes.some((prefix) => host.startsWith(prefix))
}

/**
 * Resolves redirects that can't be expressed as static edge rules in
 * vercel.json:
 *   - webfinger forwards the incoming request path
 *   - /app on conference hosts branches by User-Agent
 *   - /discord is a path shortcut on any host
 *
 * The host-wide vanity-domain catch-alls (cfp / discord / flutterday /
 * conference hosts) live in vercel.json so they run at the edge before ISR
 * can serve a path's cached apex response for a vanity-host request.
 */
export function resolveRedirect(event: H3Event): string | null {
    const host = event.headers.get('host') || ''
    const path = event.path

    if (path.startsWith('/.well-known/webfinger')) {
        return `${WEBFINGER_HOST}${path}`
    }

    if (path === '/app' && hostStartsWithAny(host, CONFERENCE_VANITY_HOSTS)) {
        const os = getOS(event.headers.get('user-agent') || '')
        return os === 'iOS' || os === 'macOS' ? PROGRAMMIER_CON_APP_IOS : PROGRAMMIER_CON_APP_ANDROID
    }

    if (path === '/discord') {
        return DISCORD_INVITE_LINK
    }

    return null
}
