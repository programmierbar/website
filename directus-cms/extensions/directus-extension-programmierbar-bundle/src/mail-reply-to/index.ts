import { defineHook } from '@directus/extensions-sdk'

const HOOK_NAME = 'mail-reply-to'

/** Directus env var holding the address replies to CMS mails should go to. */
export const EMAIL_REPLY_TO_ENV = 'EMAIL_REPLY_TO'

/**
 * Mails are sent from `EMAIL_FROM`, an address that cannot receive mail. Directus has no
 * setting for a default Reply-To, so this filter adds `EMAIL_REPLY_TO` to every mail that
 * goes through the MailService (`email.send` runs before each send): the bundle's own mails
 * (tickets, speaker portal, newsletter), Directus system mails (password reset, invites)
 * and Flows. A Reply-To set by the caller is kept. Unset or empty: no change.
 */
export default defineHook(({ filter }, { env, logger }) => {
    const replyTo = typeof env[EMAIL_REPLY_TO_ENV] === 'string' ? env[EMAIL_REPLY_TO_ENV].trim() : ''
    if (!replyTo) {
        logger.info(`${HOOK_NAME} hook: ${EMAIL_REPLY_TO_ENV} is not set, mails are sent without Reply-To.`)
        return
    }

    filter('email.send', (message: any) => {
        if (!message || message.replyTo) {
            return message
        }
        return { ...message, replyTo }
    })
})
