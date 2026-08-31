import type { DirectusMeetupItem } from '~/types/directus'

/**
 * Selects and orders meetups by their date, so the meetup overview and the
 * homepage derive their lists the same way.
 *
 * `getMeetups` sorts newest first, which is what a list of past meetups wants:
 * the most recent one on top. Upcoming meetups have to run the other way
 * round, otherwise the date furthest out is shown first and the next one sits
 * at the bottom of the section.
 *
 * Both selections take `now` as an argument rather than reading the clock
 * themselves, so a page that renders a past *and* an upcoming list compares
 * every meetup against a single reference time.
 */
type ScheduledMeetup = Pick<DirectusMeetupItem, 'start_on'>

/**
 * Upcoming meetups, soonest first.
 *
 * @param meetups The meetups to select from, in any order.
 * @param now The reference time a meetup's `start_on` is compared against.
 *
 * @returns A new array holding the meetups that start after `now`, sorted ascending.
 */
export function getUpcomingMeetups<T extends ScheduledMeetup>(meetups: T[], now: Date): T[] {
    return meetups
        .filter((meetup) => new Date(meetup.start_on) > now)
        .sort((a, b) => new Date(a.start_on).getTime() - new Date(b.start_on).getTime())
}

/**
 * Past meetups, in the order they came in — the CMS query already sorts them
 * newest first, which is the order the past list is shown in.
 *
 * @param meetups The meetups to select from.
 * @param now The reference time a meetup's `start_on` is compared against.
 *
 * @returns A new array holding the meetups that started before `now`.
 */
export function getPastMeetups<T extends ScheduledMeetup>(meetups: T[], now: Date): T[] {
    return meetups.filter((meetup) => new Date(meetup.start_on) < now)
}
