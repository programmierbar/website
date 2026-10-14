import { defineEndpoint } from '@directus/extensions-sdk'
import { checkAuthenticated } from '../newsletter/access.ts'
import { IssueAccessError, loadNewsletterIssueForUser } from '../newsletter/loadIssue.ts'
import { renderNewsletterIssue } from '../newsletter/render/index.ts'
import { buildListUnsubscribeHeaders, buildUnsubscribeUrl, TEST_UNSUBSCRIBE_TOKEN } from '../newsletter/unsubscribe.ts'
import { sendRawEmail } from '../shared/email-service.ts'
import { getRequiredSetting } from '../shared/settings.ts'

const ENDPOINT_NAME = 'newsletter-send'
const SUBSCRIBERS_COLLECTION = 'newsletter_subscribers'
export const TEST_SUBJECT_PREFIX = '[TEST] '

/**
 * Sending actions for newsletter issues, called from the `newsletter-actions`
 * interface on the `newsletter_issues` item page (same pattern as `invoice-lifecycle`
 * and `invoice-actions`).
 *
 * - POST /newsletter-send/:id/test — send the SAVED issue (live item, never a Content
 *   Version) to the requesting user's own address, with `[TEST]` in front of the
 *   subject. Any logged-in user may do this (401 otherwise), but only for an issue they
 *   can read: the issue is loaded with their own accountability. There is no recipient
 *   parameter on purpose: a test send can never reach anyone else.
 *
 * The mail is rendered by the shared `renderNewsletterIssue` (same published filter as
 * the preview and the real send) and carries the List-Unsubscribe headers. If the user
 * is a confirmed subscriber, their real unsubscribe link is used, otherwise a link with
 * a token that matches nobody. Nothing is written: no `newsletter_sends` row, no status
 * change on the issue.
 */
export default defineEndpoint((router, context) => {
    const { logger, services, getSchema } = context

    class HttpError extends Error {
        status: number
        constructor(status: number, message: string) {
            super(message)
            this.status = status
        }
    }

    /**
     * The requesting user's own address — the only possible recipient of a test send.
     *
     * Read with admin accountability because a non-admin's policy may not allow reading
     * `directus_users`; it is strictly the record of `accountability.user` and only its
     * `email` field.
     */
    async function readOwnEmail(schema: any, userId: string): Promise<string> {
        const usersService = new services.ItemsService('directus_users', { schema, accountability: { admin: true } })
        const user = await usersService.readOne(userId, { fields: ['email'] })
        const email = typeof user?.email === 'string' ? user.email.trim() : ''
        if (!email) {
            throw new HttpError(400, 'Dein Benutzerkonto hat keine E-Mail-Adresse')
        }
        return email
    }

    /** The real unsubscribe token if the address is a confirmed subscriber, otherwise null. */
    async function findSubscriberToken(schema: any, email: string): Promise<string | null> {
        const subscribersService = new services.ItemsService(SUBSCRIBERS_COLLECTION, {
            schema,
            accountability: { admin: true },
        })
        // The website stores addresses lower-cased.
        const rows = await subscribersService.readByQuery({
            filter: { email: { _eq: email.toLowerCase() }, status: { _eq: 'confirmed' } },
            fields: ['unsubscribe_token'],
            limit: 1,
        })
        return rows?.[0]?.unsubscribe_token ?? null
    }

    router.post('/:id/test', async (req: any, res: any) => {
        const accessError = checkAuthenticated(req.accountability)
        if (accessError) {
            res.status(accessError.status).send({ error: accessError.message })
            return
        }

        const id = String(req.params.id)

        try {
            const schema = await getSchema()

            // The live item only — a test send never uses a Content Version.
            const issue = await loadNewsletterIssueForUser(services, schema, req.accountability, id)

            const subject = issue.subject?.trim()
            if (!subject) {
                throw new HttpError(400, 'Die Ausgabe hat keinen Betreff')
            }

            const recipient = await readOwnEmail(schema, req.accountability.user)
            const websiteUrl = await getRequiredSetting('website_url', { logger, services, getSchema })

            const subscriberToken = await findSubscriberToken(schema, recipient)
            const unsubscribeUrl = buildUnsubscribeUrl(websiteUrl, subscriberToken ?? TEST_UNSUBSCRIBE_TOKEN)

            const { html, warnings, hidden } = await renderNewsletterIssue(issue, { websiteUrl, unsubscribeUrl })

            const sent = await sendRawEmail(
                {
                    to: recipient,
                    subject: `${TEST_SUBJECT_PREFIX}${subject}`,
                    html,
                    headers: buildListUnsubscribeHeaders(unsubscribeUrl),
                },
                { logger, services, getSchema }
            )
            if (!sent) {
                // sendRawEmail has logged the cause.
                throw new HttpError(502, 'Der Mailversand ist fehlgeschlagen – Details im Server-Log')
            }

            logger.info(
                `${ENDPOINT_NAME}: test send of issue ${id} to ${recipient} by user ${req.accountability.user} ` +
                    `(${hidden.length} hidden, ${warnings.length} warnings)`
            )

            res.status(200).send({
                recipient,
                subject: `${TEST_SUBJECT_PREFIX}${subject}`,
                unsubscribe: subscriberToken ? 'subscriber' : 'test',
                hidden,
                warnings,
            })
        } catch (err: any) {
            if (err instanceof HttpError || err instanceof IssueAccessError) {
                res.status(err.status).send({ error: err.message })
                return
            }
            logger.error(`${ENDPOINT_NAME}: test send of issue ${id} failed: ${err?.message || err}`)
            res.status(500).send({ error: 'Testversand fehlgeschlagen' })
        }
    })
})
