import { randomUUID } from 'node:crypto'
import { defineHook } from '@directus/extensions-sdk'
import { postSlackMessage } from '../shared/postSlackMessage.ts'
import { createRetentionRepository } from './util/repository.ts'
import {
    anonymiseExpiredRegistrations,
    MEETUP_REGISTRATION_RETENTION_DAYS,
    RetentionRunError,
} from './util/retention.ts'

const HOOK_NAME = 'meetup-registration-retention'

/** Every night at 03:17. */
export const RETENTION_SCHEDULE = '17 3 * * *'

/**
 * Deletes the personal data of meetup registrations
 * {@link MEETUP_REGISTRATION_RETENTION_DAYS} days after the meetup and keeps
 * only anonymised statistics. See `util/retention.ts` for the rules.
 */
export default defineHook(({ schedule }, hookContext) => {
    const { logger, env, database } = hookContext

    schedule(RETENTION_SCHEDULE, async () => {
        try {
            if (!database) throw new Error('No database connection in the hook context')

            const result = await anonymiseExpiredRegistrations(createRetentionRepository(database), {
                now: new Date(),
                createToken: randomUUID,
            })
            logger.info(
                `${HOOK_NAME}: anonymised ${result.anonymised} registration(s) ` +
                    `(${result.keptForConsent} keep only the e-mail as consent proof), ` +
                    `scanned ${result.scanned} across ${result.meetups} meetup(s) past the retention period`
            )
        } catch (error: any) {
            const done = error instanceof RetentionRunError ? error.result.anonymised : 0
            logger.error(
                `${HOOK_NAME}: run failed after ${done} anonymised registration(s): ${error?.message ?? error}`
            )
            try {
                await postSlackMessage(
                    [
                        `Achtung: Die nächtliche Anonymisierung der Meetup-Anmeldungen ist fehlgeschlagen (${error?.message ?? error}).`,
                        `In diesem Lauf wurden vorher ${done} Anmeldung(en) anonymisiert.`,
                        `Bis das behoben ist, bleiben personenbezogene Daten länger als ${MEETUP_REGISTRATION_RETENTION_DAYS} Tage nach dem Meetup gespeichert.`,
                        `Der nächste Lauf versucht es erneut und überspringt bereits anonymisierte Anmeldungen.`,
                        `Collection:`,
                        `${env.PUBLIC_URL}admin/content/meetup_registrations`,
                    ].join(' ')
                )
            } catch (slackError: any) {
                logger.error(`${HOOK_NAME}: Could not post message to Slack: ${slackError?.message ?? slackError}`)
            }
        }
    })

    logger.info(`${HOOK_NAME} hook registered`)
})
