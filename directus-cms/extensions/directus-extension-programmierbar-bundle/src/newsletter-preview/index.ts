import { defineEndpoint } from '@directus/extensions-sdk'
import { ISSUES_COLLECTION, loadNewsletterIssue } from '../newsletter/loadIssue.ts'
import { renderNewsletterIssue } from '../newsletter/render/index.ts'
import { getRequiredSetting } from '../shared/settings.ts'
import { checkAdminAccess } from './access.ts'

const ENDPOINT_NAME = 'newsletter-preview'

/**
 * Directus answers a missing item, an invalid primary key and an unknown Content
 * Version all with a ForbiddenError. The caller is an admin, so here it can only mean
 * "not found".
 */
function isNotFoundError(err: any): boolean {
    return err?.code === 'FORBIDDEN' || err?.name === 'ForbiddenError'
}

/**
 * Live Preview for newsletter issues.
 *
 * GET /newsletter-preview/:id?version=<key>
 *
 * Renders the issue through the same MJML renderer the send job will use and returns
 * the HTML. Configure it in Directus as the Preview URL of `newsletter_issues`:
 * `/newsletter-preview/{{id}}?version={{$version}}`. Without a version (or `main`) the
 * live item is rendered, otherwise the given Content Version.
 *
 * Admins only. The preview iframe is same-origin with the Data Studio, so the admin's
 * session cookie authenticates the request. Nothing is sent or written.
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
        const accessError = checkAdminAccess(req.accountability)
        if (accessError) {
            sendText(res, accessError.status, accessError.message)
            return
        }

        const id = String(req.params.id)
        const version = typeof req.query?.version === 'string' ? req.query.version : null

        try {
            const schema = await getSchema()
            const issuesService = new services.ItemsService(ISSUES_COLLECTION, {
                schema,
                accountability: req.accountability,
            })

            let issue
            try {
                issue = await loadNewsletterIssue(issuesService, id, version)
            } catch (err: any) {
                if (isNotFoundError(err)) {
                    sendText(res, 404, `Ausgabe ${id}${version ? ` (Version ${version})` : ''} nicht gefunden`)
                    return
                }
                throw err
            }

            const websiteUrl = await getRequiredSetting('website_url', { logger, services, getSchema })
            const { html, warnings } = await renderNewsletterIssue(issue, { websiteUrl, unsubscribeUrl: null })

            for (const warning of warnings) {
                logger.warn(`${ENDPOINT_NAME}: issue ${id}: ${warning}`)
            }

            res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store').send(html)
        } catch (err: any) {
            logger.error(`${ENDPOINT_NAME}: failed to render issue ${id}: ${err?.message || err}`)
            sendText(res, 500, `Vorschau konnte nicht erzeugt werden: ${err?.message || err}`)
        }
    })
})
