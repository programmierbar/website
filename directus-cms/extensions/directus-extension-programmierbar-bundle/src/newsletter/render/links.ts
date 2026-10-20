import { getUrlSlug } from '../../../../../../shared-code/index.ts'
import { joinUrl } from './escape.ts'

/** Builds the absolute website URL for a path, with the issue's campaign parameters. */
export type WebsiteLinker = (path: string) => string

/**
 * Website links in an issue carry UTM campaign parameters, so the website analytics can
 * attribute visits to the newsletter without any per-recipient tracking (no pixel, no
 * redirect links): every recipient gets the same URLs.
 *
 * `utm_campaign` is the slug of the subject, which is locked once an issue is sending,
 * so it is stable for a send. Applied in every render — preview, test send and real send
 * — so the preview shows exactly the links that are sent. Without a subject (an early
 * draft) the campaign parameter is left out.
 *
 * Only links the renderer builds get the parameters; links inside the text block's rich
 * text and the unsubscribe link stay untouched.
 */
export function createWebsiteLinker(websiteUrl: string, subject: string | null | undefined): WebsiteLinker {
    const campaign = subject?.trim() ? getUrlSlug(subject.trim()) : ''
    return (path) => {
        const url = new URL(joinUrl(websiteUrl, path))
        url.searchParams.set('utm_source', 'newsletter')
        url.searchParams.set('utm_medium', 'email')
        if (campaign) {
            url.searchParams.set('utm_campaign', campaign)
        }
        return url.toString()
    }
}
