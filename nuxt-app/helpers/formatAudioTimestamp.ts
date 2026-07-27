/**
 * Formats a time in seconds as an audio timestamp: `mm:ss`, or `h:mm:ss` once
 * past an hour. Shared by the podcast player and the news podcast reference so
 * the two stay consistent.
 *
 * @param seconds The time in seconds.
 *
 * @returns The formatted timestamp.
 */
export function formatAudioTimestamp(seconds: number): string {
    const isoString = new Date(seconds * 1000).toISOString()
    return seconds < 3600 ? isoString.slice(14, 19) : isoString.slice(11, 19)
}
