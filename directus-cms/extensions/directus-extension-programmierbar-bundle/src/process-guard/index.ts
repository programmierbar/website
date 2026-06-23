import { defineHook } from '@directus/extensions-sdk'
import { postSlackMessage } from '../shared/postSlackMessage.ts'

const HOOK_NAME = 'process-guard'

// Guard against attaching the listeners more than once if the bundle re-initializes.
let registered = false

/**
 * A last-resort, process-level safety net. Even if an individual hook misses a
 * `.catch`, an unhandled promise rejection must never take the whole CMS down.
 *
 * - unhandledRejection: swallowed + logged (and reported to Slack). This is the
 *   crash class that previously rebooted the CMS on hook failures.
 * - uncaughtException: logged + reported, then the process exits so the host can
 *   restart it cleanly — after a synchronous crash the in-memory state may be
 *   corrupt, so running on is riskier than a clean restart.
 */
export default defineHook((_, { logger }) => {
    if (registered) {
        return
    }
    registered = true

    process.on('unhandledRejection', (reason: any) => {
        logger.error(`${HOOK_NAME}: suppressed unhandledRejection: ${reason?.stack ?? reason}`)
        postSlackMessage(
            `:rotating_light: *${HOOK_NAME}*: suppressed unhandledRejection: ${reason?.message ?? reason}`
        ).catch(() => {})
    })

    process.on('uncaughtException', (error: any) => {
        logger.error(`${HOOK_NAME}: uncaughtException: ${error?.stack ?? error}`)
        postSlackMessage(
            `:rotating_light: *${HOOK_NAME}*: uncaughtException, restarting: ${error?.message ?? error}`
        )
            .catch(() => {})
            .finally(() => setTimeout(() => process.exit(1), 1000))
    })

    logger.info(`${HOOK_NAME} hook: Registered global unhandledRejection/uncaughtException handlers.`)
})
