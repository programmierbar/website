import { defineEndpoint } from '@directus/extensions-sdk'
import { checkAdminAccess } from '../newsletter/access.ts'
import { isNotFoundError, ISSUES_COLLECTION, loadNewsletterIssue } from '../newsletter/loadIssue.ts'
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
 * and `invoice-actions`). Admins only.
 *
 * - POST /newsletter-send/:id/test — send the SAVED issue (live item, never a Content
 *   Version) to the requesting admin's own address, with `[TEST]` in front of the
 *   subject. There is no recipient parameter on purpose: a test send can never reach
 *   anyone else.
 *
 * The mail is rendered by the shared `renderNewsletterIssue` (same published filter as
 * the preview and the real send) and carries the List-Unsubscribe headers. If the admin
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

    /** The requesting admin's own address — the only possible recipient of a test send. */
    async function readOwnEmail(schema: any, accountability: any): Promise<string> {
        if (!accountability?.user) {
            throw new HttpError(400, 'Zum Testversand muss ein Benutzerkonto angemeldet sein')
        }
        const usersService = new services.ItemsService('directus_users', { schema, accountability })
        const user = await usersService.readOne(accountability.user, { fields: ['email'] })
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
        const accessError = checkAdminAccess(req.accountability)
        if (accessError) {
            res.status(accessError.status).send({ error: accessError.message })
            return
        }

        const id = String(req.params.id)

        try {
            const schema = await getSchema()

            let issue
            try {
                const issuesService = new services.ItemsService(ISSUES_COLLECTION, {
                    schema,
                    accountability: req.accountability,
                })
                issue = await loadNewsletterIssue(issuesService, id)
            } catch (err: any) {
                if (isNotFoundError(err)) {
                    throw new HttpError(404, `Ausgabe ${id} nicht gefunden – ist sie schon gespeichert?`)
                }
                throw err
            }

            const subject = issue.subject?.trim()
            if (!subject) {
                throw new HttpError(400, 'Die Ausgabe hat keinen Betreff')
            }

            const recipient = await readOwnEmail(schema, req.accountability)
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
            if (err instanceof HttpError) {
                res.status(err.status).send({ error: err.message })
                return
            }
            logger.error(`${ENDPOINT_NAME}: test send of issue ${id} failed: ${err?.message || err}`)
            res.status(500).send({ error: 'Testversand fehlgeschlagen' })
        }
    })
})
