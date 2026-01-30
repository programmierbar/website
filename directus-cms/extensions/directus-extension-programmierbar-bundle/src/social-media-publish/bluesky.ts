/**
 * Bluesky publishing via AT Protocol
 *
 * Bluesky uses the AT Protocol. To post:
 * 1. Authenticate with handle + app password to get a session
 * 2. Create a post record using com.atproto.repo.createRecord
 *
 * App passwords can be created at: https://bsky.app/settings/app-passwords
 */

interface BlueskyConfig {
    handle: string
    appPassword: string
    logger: { info: (msg: string) => void; error: (msg: string) => void }
}

interface BlueskySession {
    did: string
    accessJwt: string
}

interface BlueskyFacet {
    index: { byteStart: number; byteEnd: number }
    features: Array<{ $type: string; uri?: string; did?: string; tag?: string }>
}

const BSKY_SERVICE = 'https://bsky.social'

/**
 * Authenticate with Bluesky using app password
 */
async function createSession(handle: string, appPassword: string): Promise<BlueskySession> {
    const response = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identifier: handle,
            password: appPassword,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Bluesky auth failed: ${response.status} ${error}`)
    }

    const data = await response.json()
    return {
        did: data.did,
        accessJwt: data.accessJwt,
    }
}

/**
 * Detect URLs, mentions (@handle.bsky.social), and hashtags (#tag) in text
 * and create facets for rich text formatting
 */
function detectFacets(text: string): BlueskyFacet[] {
    const facets: BlueskyFacet[] = []
    const encoder = new TextEncoder()

    // Detect URLs
    const urlRegex = /https?:\/\/[^\s<>\"{}|\\^`\[\]]+/g
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(text)) !== null) {
        const byteStart = encoder.encode(text.slice(0, match.index)).length
        const byteEnd = byteStart + encoder.encode(match[0]).length
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
        })
    }

    // Detect mentions (@handle)
    const mentionRegex = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g
    while ((match = mentionRegex.exec(text)) !== null) {
        const byteStart = encoder.encode(text.slice(0, match.index)).length
        const byteEnd = byteStart + encoder.encode(match[0]).length
        // Note: In a full implementation, we'd resolve the handle to a DID here
        // For now, we'll include the mention facet without the DID
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#mention', did: '' }],
        })
    }

    // Detect hashtags (#tag)
    const hashtagRegex = /#[a-zA-Z][a-zA-Z0-9_]*/g
    while ((match = hashtagRegex.exec(text)) !== null) {
        const byteStart = encoder.encode(text.slice(0, match.index)).length
        const byteEnd = byteStart + encoder.encode(match[0]).length
        facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#tag', tag: match[0].slice(1) }],
        })
    }

    // Filter out mentions without DIDs (they need to be resolved)
    return facets.filter((f) => {
        const mention = f.features.find((feat) => feat.$type === 'app.bsky.richtext.facet#mention')
        return !mention || mention.did
    })
}

/**
 * Resolve a Bluesky handle to a DID
 */
async function resolveHandle(handle: string): Promise<string | null> {
    try {
        // Remove @ prefix if present
        const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle

        const response = await fetch(
            `${BSKY_SERVICE}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`
        )

        if (!response.ok) {
            return null
        }

        const data = await response.json()
        return data.did || null
    } catch {
        return null
    }
}

/**
 * Publish a post to Bluesky
 */
export async function publishToBluesky(
    text: string,
    config: BlueskyConfig
): Promise<{ postId: string; postUrl: string }> {
    const { handle, appPassword, logger } = config

    logger.info(`Bluesky: Authenticating as ${handle}`)
    const session = await createSession(handle, appPassword)

    // Detect and create facets for rich text
    let facets = detectFacets(text)

    // Resolve mentions to DIDs
    const mentionRegex = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g
    const encoder = new TextEncoder()
    let match: RegExpExecArray | null

    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionHandle = match[0].slice(1) // Remove @
        const did = await resolveHandle(mentionHandle)

        if (did) {
            const byteStart = encoder.encode(text.slice(0, match.index)).length
            const byteEnd = byteStart + encoder.encode(match[0]).length
            facets.push({
                index: { byteStart, byteEnd },
                features: [{ $type: 'app.bsky.richtext.facet#mention', did }],
            })
        }
    }

    // Build the post record
    const record: Record<string, unknown> = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
    }

    if (facets.length > 0) {
        record.facets = facets
    }

    logger.info(`Bluesky: Creating post`)
    const response = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.feed.post',
            record,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Bluesky post failed: ${response.status} ${error}`)
    }

    const result = await response.json()

    // Extract rkey from uri: at://did:plc:xxx/app.bsky.feed.post/rkey
    const rkey = result.uri.split('/').pop()
    const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`

    return {
        postId: result.uri,
        postUrl,
    }
}
