// Confirm and unsubscribe tokens are UUID columns in Directus. A malformed value
// (a hand-shortened link, a mangled copy & paste) does not just miss: Directus
// answers the lookup with a 500. Checking the format first keeps such links on
// the neutral 'invalid' answer they deserve, without a round trip.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isWellFormedNewsletterToken(token: unknown): token is string {
    return typeof token === 'string' && UUID_PATTERN.test(token)
}
