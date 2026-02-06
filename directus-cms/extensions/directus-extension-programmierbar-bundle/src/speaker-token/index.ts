import { defineHook } from '@directus/extensions-sdk'
import { randomUUID } from 'node:crypto'

const HOOK_NAME = 'speaker-token'

export default defineHook(({ filter }, hookContext) => {
    const logger = hookContext.logger

    /**
     * Automatically generates a portal token when a new speaker is created.
     */
    filter('speakers.items.create', (payload) => {
        logger.info(`${HOOK_NAME} hook: Generating portal token for new speaker`)

        const token = randomUUID()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 14) // 14 days from now

        return {
            ...payload,
            portal_token: token,
            portal_token_expires: expiresAt.toISOString(),
            portal_submission_status: 'pending',
        }
    })
})
