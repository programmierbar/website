import type { DirectusMeetupItem } from '~/types/directus'
import { getPlainText } from './sanitize'

/**
 * Returns the teaser text of a meetup as plain text.
 *
 * The teaser prose belongs in `intro`; `description` carries the event details, and since late 2025
 * that is the recurring call for Lightning-Talk speakers plus the agenda, which reads as boilerplate
 * on every card and in every link preview. Meetups created before then left `intro` empty and put
 * their prose in `description`, so fall back to it rather than returning nothing.
 *
 * Both fields are CMS rich text, so both go through `getPlainText`: it strips the markup and decodes
 * entities, and it also turns an `intro` that is null or nothing but empty tags into an empty string,
 * which is what the fallback tests.
 *
 * Not re-exported from `helpers/index.ts`, for the same reason as `helpers/sanitize.ts`.
 *
 * @param meetup The meetup with its `intro` and `description`.
 *
 * @returns The plain-text teaser.
 */
export function getMeetupTeaser(meetup: Pick<DirectusMeetupItem, 'intro' | 'description'>): string {
    return getPlainText(meetup.intro) || getPlainText(meetup.description)
}
