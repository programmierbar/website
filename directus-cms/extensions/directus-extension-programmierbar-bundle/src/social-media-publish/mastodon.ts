/**
 * Mastodon publishing via standard Mastodon API
 *
 * Mastodon uses a simple REST API with OAuth access tokens.
 * To post:
 * 1. Use the access token (obtained from app settings)
 * 2. POST to /api/v1/statuses
 *
 * Access tokens can be obtained from: Settings > Development > New Application
 */

interface MastodonConfig {
    instanceUrl: string
    accessToken: string
    logger: { info: (msg: string) => void; error: (msg: string) => void }
}

interface MastodonStatus {
    id: string
    url: string
    uri: string
    created_at: string
    content: string
}

/**
 * Publish a status (toot) to Mastodon
 */
export async function publishToMastodon(
    text: string,
    config: MastodonConfig
): Promise<{ postId: string; postUrl: string }> {
    const { instanceUrl, accessToken, logger } = config

    // Ensure instance URL doesn't have trailing slash
    const baseUrl = instanceUrl.replace(/\/$/, '')

    logger.info(`Mastodon: Posting to ${baseUrl}`)

    const response = await fetch(`${baseUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            status: text,
            visibility: 'public',
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Mastodon post failed: ${response.status} ${error}`)
    }

    const status: MastodonStatus = await response.json()

    logger.info(`Mastodon: Successfully posted status ${status.id}`)

    return {
        postId: status.id,
        postUrl: status.url,
    }
}

/**
 * Schedule a status for future publication
 * Note: Mastodon supports scheduled posts natively
 */
export async function scheduleToMastodon(
    text: string,
    scheduledAt: Date,
    config: MastodonConfig
): Promise<{ scheduledId: string }> {
    const { instanceUrl, accessToken, logger } = config

    const baseUrl = instanceUrl.replace(/\/$/, '')

    logger.info(`Mastodon: Scheduling post for ${scheduledAt.toISOString()}`)

    const response = await fetch(`${baseUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            status: text,
            visibility: 'public',
            scheduled_at: scheduledAt.toISOString(),
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Mastodon schedule failed: ${response.status} ${error}`)
    }

    const result = await response.json()

    return {
        scheduledId: result.id,
    }
}

/**
 * Verify the access token is valid by fetching account info
 */
export async function verifyCredentials(config: MastodonConfig): Promise<{ username: string; url: string }> {
    const { instanceUrl, accessToken } = config

    const baseUrl = instanceUrl.replace(/\/$/, '')

    const response = await fetch(`${baseUrl}/api/v1/accounts/verify_credentials`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Mastodon auth verification failed: ${response.status} ${error}`)
    }

    const account = await response.json()

    return {
        username: account.username,
        url: account.url,
    }
}
