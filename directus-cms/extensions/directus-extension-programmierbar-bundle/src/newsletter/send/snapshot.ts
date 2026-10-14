import { escapeHtml } from '../render/escape.ts'

/**
 * Stands in for the personal unsubscribe link in `html_snapshot`. The issue is rendered
 * once when the send starts; each mail then gets the recipient's own link in its place.
 * Only URL-safe characters, so escaping and MJML leave it untouched.
 */
export const UNSUBSCRIBE_URL_PLACEHOLDER = 'https://newsletter.invalid/__UNSUBSCRIBE_URL__'

export function hasUnsubscribePlaceholder(html: string | null | undefined): html is string {
    return typeof html === 'string' && html.includes(UNSUBSCRIBE_URL_PLACEHOLDER)
}

/** The snapshot with the recipient's unsubscribe link in place of the placeholder. */
export function personalizeSnapshot(html: string, unsubscribeUrl: string): string {
    return html.split(UNSUBSCRIBE_URL_PLACEHOLDER).join(escapeHtml(unsubscribeUrl))
}
