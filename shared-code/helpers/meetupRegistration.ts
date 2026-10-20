import type { CalendarEvent } from './eventCalendar';
import { getEventVenueLine } from './eventVenue';

/**
 * Rules of the free meetup registration, shared so the website (availability
 * shown on the page) and the CMS (authoritative check before every insert)
 * cannot disagree about when a meetup is open, full or closed.
 */

export type MeetupRegistrationState = 'open' | 'full' | 'closed' | 'disabled';

export interface MeetupRegistrationSettings {
  status?: string | null;
  start_on: string;
  registration_enabled?: boolean | null;
  /** `null` means unlimited. */
  registration_limit?: number | null;
}

/**
 * Lotum colleagues register through the public form like everyone else. Their
 * company address marks the registration as internal: it is counted for
 * catering but not against the public `registration_limit` (same idea as
 * `tickets.is_internal` for the conference).
 */
export const INTERNAL_EMAIL_DOMAINS = ['lotum.de'] as const;

/** Trim and lower-case, so duplicates are detected case-insensitively. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isInternalEmail(email: string) {
  const domain = normalizeEmail(email).split('@').pop() ?? '';
  return (INTERNAL_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

/**
 * Decide whether a meetup accepts registrations.
 *
 * @param publicCount Confirmed, non-internal registrations so far.
 * @param now Injectable for tests.
 * @returns The state plus the public spots left (`null` when unlimited).
 */
export function getMeetupRegistrationState(
  meetup: MeetupRegistrationSettings,
  publicCount: number,
  now: Date = new Date()
): { state: MeetupRegistrationState; spotsLeft: number | null } {
  const limit = typeof meetup.registration_limit === 'number' ? meetup.registration_limit : null;
  const spotsLeft = limit === null ? null : Math.max(0, limit - publicCount);

  if (meetup.status !== 'published' || meetup.registration_enabled !== true) {
    return { state: 'disabled', spotsLeft };
  }

  // Registration closes when the event starts.
  const startsAt = new Date(meetup.start_on).getTime();
  if (!Number.isFinite(startsAt) || startsAt <= now.getTime()) {
    return { state: 'closed', spotsLeft };
  }

  if (spotsLeft === 0) {
    return { state: 'full', spotsLeft };
  }

  return { state: 'open', spotsLeft };
}

/**
 * Error codes the CMS rejects a registration with. The website maps them to its
 * answers: `duplicate` becomes the normal success (the confirmation is resent,
 * and nobody can probe whether an address is registered), the others become
 * "ausgebucht" / "Anmeldung geschlossen".
 */
export const MEETUP_REGISTRATION_ERROR_CODES = {
  full: 'MEETUP_REGISTRATION_FULL',
  closed: 'MEETUP_REGISTRATION_CLOSED',
  disabled: 'MEETUP_REGISTRATION_DISABLED',
  duplicate: 'MEETUP_REGISTRATION_DUPLICATE',
} as const;

/** Answers to "Wie hast du von diesem Meetup erfahren?" (stored as `value`). */
export const MEETUP_HEARD_ABOUT_OPTIONS = [
  { value: 'podcast', label: 'Podcast' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'meetup_com', label: 'meetup.com' },
  { value: 'other', label: 'Sonstiges' },
] as const;

export type MeetupHeardAboutValue = (typeof MEETUP_HEARD_ABOUT_OPTIONS)[number]['value'];

/** Path of the per-meetup .ics file served by the website. */
export function getMeetupIcsPath(slug: string) {
  return `/meetup/${slug}/kalender.ics`;
}

/** The calendar entry for a meetup, identical on the page, in the .ics file and in the mail. */
export function getMeetupCalendarEvent(
  meetup: { id: string | number; slug: string; title: string; start_on: string; end_on: string },
  websiteUrl: string
): CalendarEvent {
  const url = `${websiteUrl}/meetup/${meetup.slug}`;

  return {
    uid: `meetup-${meetup.id}@programmier.bar`,
    title: `programmier.bar Meetup: ${meetup.title}`,
    start: meetup.start_on,
    end: meetup.end_on,
    location: getEventVenueLine(),
    description: url,
    url,
  };
}
