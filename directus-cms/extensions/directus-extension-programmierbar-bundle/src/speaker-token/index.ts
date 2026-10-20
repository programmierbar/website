import { defineHook } from '@directus/extensions-sdk'
import { createPortalToken } from '../shared/speakerPortal.ts'

const HOOK_NAME = 'speaker-token'

export default defineHook(({ filter }, hookContext) => {
    const logger = hookContext.logger

    /**
     * Automatically generates a portal token when a new speaker is created.
     */
    filter('speakers.items.create', (payload) => {
        logger.info(`${HOOK_NAME} hook: Generating portal token for new speaker`)

        return {
            ...payload,
            ...createPortalToken(),
            portal_submission_status: 'pending',
        }
    })
})
