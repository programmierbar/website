/**
 * Data shapes the newsletter renderer consumes. They mirror the Directus collections
 * `newsletter_issues` → M2A `blocks` (junction `newsletter_issues_blocks`) →
 * `newsletter_blocks_text` / `newsletter_blocks_podcasts` / `newsletter_blocks_meetups`,
 * as returned by {@link ../loadIssue.ts} with the relations expanded.
 *
 * Every field is optional/nullable on purpose: the renderer also runs for the Live
 * Preview of half-finished drafts, so it must cope with missing data instead of
 * assuming a complete, validated issue.
 */

export const TEXT_BLOCK_COLLECTION = 'newsletter_blocks_text'
export const PODCASTS_BLOCK_COLLECTION = 'newsletter_blocks_podcasts'
export const MEETUPS_BLOCK_COLLECTION = 'newsletter_blocks_meetups'

export interface NewsletterPodcast {
    slug?: string | null
    type?: string | null
    number?: string | null
    title?: string | null
}

export interface NewsletterMeetup {
    slug?: string | null
    title?: string | null
    start_on?: string | null
}

export interface NewsletterTextBlock {
    heading?: string | null
    /** Rich-text HTML from the Directus WYSIWYG editor. */
    body?: string | null
}

export interface NewsletterPodcastsBlock {
    heading?: string | null
    podcasts?: Array<{ sort?: number | null; podcasts_id?: NewsletterPodcast | null }> | null
}

export interface NewsletterMeetupsBlock {
    heading?: string | null
    meetups?: Array<{ sort?: number | null; meetups_id?: NewsletterMeetup | null }> | null
}

/** One row of the M2A junction `newsletter_issues_blocks`. */
export interface NewsletterIssueBlock {
    sort?: number | null
    collection?: string | null
    item?: NewsletterTextBlock | NewsletterPodcastsBlock | NewsletterMeetupsBlock | null
}

export interface NewsletterIssue {
    subject?: string | null
    preheader?: string | null
    blocks?: NewsletterIssueBlock[] | null
}

export interface RenderOptions {
    /** Public website base URL (the `website_url` setting); podcast/meetup links point here. */
    websiteUrl: string
    /**
     * The recipient's personal unsubscribe link. Left out for the Live Preview, where a
     * placeholder is rendered instead; the send path must always pass it.
     */
    unsubscribeUrl?: string | null
}

export interface RenderResult {
    html: string
    /** MJML validation errors and skipped blocks — never thrown, so the caller decides how loud to be. */
    warnings: string[]
}
