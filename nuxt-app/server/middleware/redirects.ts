import { resolveRedirect } from '../utils/redirects'

/**
 * Single entry point for all vanity-domain and shortcut redirects.
 *
 * Replaces the previous one-file-per-redirect middlewares (cfp, conference,
 * flutterday, discord, well-known/webfinger). Centralising the logic means the
 * "never redirect API / internal requests" guard lives in exactly one place
 * instead of being copy-pasted (and forgotten) per file.
 */
export default eventHandler((event) => {
    const redirectUrl = resolveRedirect(event)
    if (!redirectUrl) {
        return
    }

    event.node.res.writeHead(302, {
        Location: redirectUrl,
    })
    event.node.res.end()
})
