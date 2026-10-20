import { getFullSpeakerName } from '../../../../../../shared-code/index.ts'
import { escapeHtml, htmlToText } from '../../shared/html.ts'

/**
 * The short profile summary in the profile-update request mail, so the speaker sees at a glance
 * what is currently on the website before deciding whether anything needs changing.
 *
 * The result is HTML and goes into the template RAW (`{{{profile_overview}}}`), so every value
 * from the speaker record is escaped here.
 */

export const BIO_EXCERPT_LENGTH = 300

/** The link fields the portal form edits, with the label shown in the overview. */
export const SPEAKER_LINK_FIELDS = [
    ['website_url', 'Website'],
    ['linkedin_url', 'LinkedIn'],
    ['twitter_url', 'Twitter / X'],
    ['bluesky_url', 'Bluesky'],
    ['github_url', 'GitHub'],
    ['instagram_url', 'Instagram'],
    ['youtube_url', 'YouTube'],
    ['mastodon_url', 'Mastodon'],
] as const

type LinkField = (typeof SPEAKER_LINK_FIELDS)[number][0]

export type ProfileOverviewSpeaker = {
    academic_title?: string | null
    first_name: string
    last_name: string
    occupation?: string | null
    description?: string | null
    profile_image?: string | null
    event_image?: string | null
} & Partial<Record<LinkField, string | null>>

const MISSING = 'noch nicht angegeben'

/**
 * HTML-escape a value and also encode curly braces: the mail renderer substitutes `{{…}}` AFTER
 * inserting this raw block, so a bio containing `{{portal_url}}` must not become a placeholder.
 */
function escapeValue(value: string): string {
    return escapeHtml(value).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;')
}

/**
 * Shorten plain text to at most `maxLength` characters, at a word boundary where one is close,
 * and mark the cut with an ellipsis.
 */
export function excerpt(text: string, maxLength: number = BIO_EXCERPT_LENGTH): string {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) {
        return normalized
    }

    const cut = normalized.slice(0, maxLength - 1)
    const lastSpace = cut.lastIndexOf(' ')
    // Only back up to the last word boundary if that does not throw away a big chunk.
    const shortened = lastSpace > maxLength * 0.75 ? cut.slice(0, lastSpace) : cut
    return `${shortened.trimEnd()}…`
}

/** Plain-text excerpt of the rich-text bio (links keep their visible text only). */
export function bioExcerpt(descriptionHtml: string | null | undefined, maxLength: number = BIO_EXCERPT_LENGTH) {
    return excerpt(
        htmlToText(descriptionHtml ?? '', (href, text) => text || href),
        maxLength
    )
}

function row(label: string, valueHtml: string): string {
    return (
        '<tr>' +
        `<td style="padding:4px 16px 4px 0;vertical-align:top;font-weight:bold;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;vertical-align:top">${valueHtml}</td>` +
        '</tr>'
    )
}

function textOrMissing(value: string | null | undefined): string {
    const trimmed = value?.trim()
    return trimmed ? escapeValue(trimmed) : `<em>${MISSING}</em>`
}

export function renderProfileOverview(speaker: ProfileOverviewSpeaker): string {
    const links = SPEAKER_LINK_FIELDS.filter(([field]) => speaker[field]?.trim()).map(([, label]) => label)
    const bio = bioExcerpt(speaker.description)

    const rows = [
        row(
            'Name',
            textOrMissing(
                getFullSpeakerName({
                    academic_title: speaker.academic_title,
                    first_name: speaker.first_name ?? '',
                    last_name: speaker.last_name ?? '',
                })
            )
        ),
        row('Jobtitel und Unternehmen', textOrMissing(speaker.occupation)),
        row('Bio', textOrMissing(bio)),
        row('Links', links.length > 0 ? escapeValue(links.join(', ')) : `<em>keine</em>`),
        row('Profilbild', speaker.profile_image ? 'vorhanden' : `<em>fehlt</em>`),
        row('Action Shot', speaker.event_image ? 'vorhanden' : `<em>fehlt</em>`),
    ]

    return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.join('')}</table>`
}
