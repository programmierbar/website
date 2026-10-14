import { defineEndpoint } from '@directus/extensions-sdk'
import { checkAuthenticated } from '../newsletter/access.ts'
import { IssueAccessError, loadNewsletterIssueForUser } from '../newsletter/loadIssue.ts'
import { renderNewsletterIssue } from '../newsletter/render/index.ts'
import { getRequiredSetting } from '../shared/settings.ts'
import { buildPreviewNotice, injectPreviewNotice } from './notice.ts'

const ENDPOINT_NAME = 'newsletter-preview'

/**
 * Live Preview for newsletter issues.
 *
 * GET /newsletter-preview/:id?version=<key>
 *
 * Renders the issue through the same MJML renderer the send job will use and returns
 * the HTML, with a preview-only notice above the mail listing unpublished podcasts/meetups
 * the renderer left out (the send job leaves them out too). Configure it in Directus as
 * the Preview URL of `newsletter_issues`: `/newsletter-preview/{{id}}?version={{$version}}`. Without a version (or `main`) the
 * live item is rendered, otherwise the given Content Version.
 *
 * Open to every logged-in user (401 otherwise); the issue is read with their own
 * permissions (403 without read access, 404 if it does not exist). The preview iframe is
 * same-origin with the Data Studio, so the user's session cookie authenticates the
 * request. Nothing is sent or written.
 */
export default defineEndpoint((router, context) => {
    const { logger, services, getSchema } = context

    const sendText = (res: any, status: number, message: string) => {
        res.status(status)
            .set('Content-Type', 'text/plain; charset=utf-8')
            .set('Cache-Control', 'no-store')
            .send(message)
    }

    router.get('/:id', async (req: any, res: any) => {
        const accessError = checkAuthenticated(req.accountability)
        if (accessError) {
            sendText(res, accessError.status, accessError.message)
            return
        }

        const id = String(req.params.id)
        const version = typeof req.query?.version === 'string' ? req.query.version : null

        try {
            const schema = await getSchema()
            let issue
            try {
                issue = await loadNewsletterIssueForUser(services, schema, req.accountability, id, version)
            } catch (err: any) {
                if (err instanceof IssueAccessError) {
                    sendText(res, err.status, err.message)
                    return
                }
                throw err
            }

            const websiteUrl = await getRequiredSetting('website_url', { logger, services, getSchema })
            const { html, warnings, hidden } = await renderNewsletterIssue(issue, {
                websiteUrl,
                unsubscribeUrl: null,
            })

            for (const warning of warnings) {
                logger.warn(`${ENDPOINT_NAME}: issue ${id}: ${warning}`)
            }

            res.status(200)
                .set('Content-Type', 'text/html; charset=utf-8')
                .set('Cache-Control', 'no-store')
                .send(injectPreviewNotice(html, buildPreviewNotice({ warnings, hidden })))
        } catch (err: any) {
            logger.error(`${ENDPOINT_NAME}: failed to render issue ${id}: ${err?.message || err}`)
            sendText(res, 500, `Vorschau konnte nicht erzeugt werden: ${err?.message || err}`)
        }
    })
})
