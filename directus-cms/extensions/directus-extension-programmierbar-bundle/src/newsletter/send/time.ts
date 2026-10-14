const BERLIN_PARTS = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
})

function berlinParts(date: Date) {
    const parts = Object.fromEntries(BERLIN_PARTS.formatToParts(date).map((part) => [part.type, part.value]))
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    }
}

/** The calendar day in Berlin, e.g. `2026-10-14` — the unit of the daily sending limit. */
export function berlinDayKey(now: Date): string {
    const { year, month, day } = berlinParts(now)
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The instant the current Berlin day started (midnight Europe/Berlin), DST-aware. */
export function berlinDayStart(now: Date): Date {
    const { year, month, day } = berlinParts(now)
    const utcMidnight = Date.UTC(year, month - 1, day)
    const wall = berlinParts(new Date(utcMidnight))
    const offset = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - utcMidnight
    return new Date(utcMidnight - offset)
}

/**
 * Parse a Directus `dateTime` value (e.g. `scheduled_at`). The field type stores wall
 * time without a zone, and Directus reads and writes it in the server's local time zone,
 * so the same local interpretation is used here (`new Date` on a zone-less ISO string is
 * local time). Values with an explicit offset are honoured. Returns null when unparsable.
 */
export function parseDirectusDateTime(value: string | null | undefined): Date | null {
    if (!value) {
        return null
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}
