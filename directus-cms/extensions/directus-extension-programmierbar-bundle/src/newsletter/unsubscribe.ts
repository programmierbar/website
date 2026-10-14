import { joinUrl } from './render/escape.ts'

/**
 * A well-formed token that matches no subscriber. Test sends to an address that is not a
 * confirmed subscriber get it, so the link and the one-click header behave like the real
 * thing (the website answers "invalid link") without opting anyone out.
 *
 * It must be a valid UUID: `unsubscribe_token` is a uuid column and Directus answers a
 * malformed value with a 500 instead of an empty result.
 */
export const TEST_UNSUBSCRIBE_TOKEN = '00000000-0000-0000-0000-000000000000'

/**
 * The website's unsubscribe link for a subscriber's permanent `unsubscribe_token`. The
 * same URL serves the page (GET) and the RFC 8058 one-click opt-out (POST).
 */
export function buildUnsubscribeUrl(websiteUrl: string, token: string): string {
    return `${joinUrl(websiteUrl, 'newsletter/unsubscribe')}?token=${encodeURIComponent(token)}`
}

/**
 * List-Unsubscribe headers (RFC 2369) with one-click support (RFC 8058). Only the https
 * link: there is no mailbox that processes unsubscribe mails, so no `mailto:` entry.
 */
export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
    return {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
}
