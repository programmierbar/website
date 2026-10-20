/**
 * Calendar entries for events: an .ics file and "add to calendar" links for
 * Google Calendar, Outlook.com and Microsoft 365. Shared because the website
 * (meetup page, .ics route) and the CMS (confirmation mail) offer the same links.
 */
export interface CalendarEvent {
  /** Stable, globally unique id, so re-importing updates instead of duplicating. */
  uid: string;
  title: string;
  /** ISO 8601 timestamps (with offset or `Z`). */
  start: string;
  end: string;
  location?: string;
  description?: string;
  url?: string;
}

/** `2026-11-19T17:00:00.000Z` → `20261119T170000Z` (UTC, as RFC 5545 and Google expect). */
function toUtcBasic(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
}

/** `2026-11-19T17:00:00.000Z` → `2026-11-19T17:00:00Z` (what Outlook's compose links expect). */
function toUtcExtended(iso: string) {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Escape a TEXT value per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Fold a content line at 75 octets (RFC 5545 §3.1). Counts UTF-8 bytes and never
 * splits a multi-byte character, so umlauts survive.
 */
export function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  // The first line may hold 75 octets; continuation lines start with a space.
  let limit = 75;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = ' ';
      currentBytes = 1;
      limit = 75;
    }
    current += char;
    currentBytes += charBytes;
  }
  parts.push(current);

  return parts.join('\r\n');
}

/**
 * Build a complete VCALENDAR with one VEVENT. Lines end in CRLF.
 *
 * @param now Used for DTSTAMP; injectable for tests.
 */
export function buildIcsCalendar(event: CalendarEvent, now: Date = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//programmier.bar//Meetups//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toUtcBasic(now.toISOString())}`,
    `DTSTART:${toUtcBasic(event.start)}`,
    `DTEND:${toUtcBasic(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * Encode query parameters with `%20` for spaces. `URLSearchParams` would write
 * `+`, which Outlook shows literally in the event title.
 */
function toQuery(params: Record<string, string | undefined>) {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}

export function getGoogleCalendarUrl(event: CalendarEvent) {
  const query = toQuery({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toUtcBasic(event.start)}/${toUtcBasic(event.end)}`,
    location: event.location,
    details: event.description,
  });

  return `https://calendar.google.com/calendar/render?${query}`;
}

/**
 * Outlook's "compose event" deep link. Outlook.com (personal accounts) and
 * Microsoft 365 (work accounts) take the same parameters on different hosts.
 */
export function getOutlookCalendarUrl(event: CalendarEvent, variant: 'outlook' | 'office365') {
  const host = variant === 'outlook' ? 'outlook.live.com' : 'outlook.office.com';
  const query = toQuery({
    subject: event.title,
    startdt: toUtcExtended(event.start),
    enddt: toUtcExtended(event.end),
    location: event.location,
    body: event.description,
  });

  return `https://${host}/calendar/0/action/compose?${query}`;
}

/** All "add to calendar" links for an event; the .ics file is served at `icsUrl`. */
export function getCalendarLinks(event: CalendarEvent, icsUrl: string) {
  return {
    google: getGoogleCalendarUrl(event),
    outlook: getOutlookCalendarUrl(event, 'outlook'),
    office365: getOutlookCalendarUrl(event, 'office365'),
    ics: icsUrl,
  };
}
