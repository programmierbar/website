/**
 * Parses an ISO-8601-ish datetime string from the CMS into a `Date`.
 *
 * Background: some Directus collections (e.g. `conferences`) store datetimes
 * as bare wall-clock strings like `"2026-11-25T08:00:00"` — no `Z`, no
 * `±HH:MM` offset. ECMAScript parses those as the *runtime's* local time,
 * which means Vercel (UTC) and a Berlin browser end up with `Date`s that
 * represent different UTC instants for the same input string. That
 * discrepancy survives even when formatters are pinned to `Europe/Berlin`,
 * because the underlying instants are already different.
 *
 * This helper resolves the ambiguity deterministically: bare strings are
 * interpreted as wall-clock time in Europe/Berlin (the conference/meetup
 * location), so SSR and client produce the same instant. Strings that
 * already carry a TZ designator (`Z` or `±HH:MM`) are passed through to
 * `new Date()` unchanged.
 */
const BARE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/

const berlinPartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
})

export function parseCmsDate(input: string): Date {
    const match = BARE_DATETIME.exec(input)
    if (!match) {
        return new Date(input)
    }
    const [, year, month, day, hour, minute, second] = match
    // Tentatively interpret the wall-clock string as if it were UTC, then ask
    // Europe/Berlin what wall-clock that instant corresponds to. The delta is
    // Berlin's offset to UTC at the original wall-clock time (handling DST).
    const tentativeUtcMs = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)
    const parts = Object.fromEntries(
        berlinPartsFormatter.formatToParts(new Date(tentativeUtcMs)).map((p) => [p.type, p.value])
    )
    const berlinHour = parts.hour === '24' ? '00' : parts.hour
    const berlinShownAsUtcMs = Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +berlinHour,
        +parts.minute,
        +parts.second
    )
    const offsetMs = berlinShownAsUtcMs - tentativeUtcMs
    return new Date(tentativeUtcMs - offsetMs)
}
