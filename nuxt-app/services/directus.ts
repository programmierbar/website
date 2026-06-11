import { authentication, createDirectus, rest } from '@directus/sdk'
import { DIRECTUS_CMS_URL } from '../config'
import type {
  DirectusAboutPage,
  DirectusCocPage,
  DirectusConferencePage,
  DirectusContactPage,
  DirectusHallOfFamePage,
  DirectusHomePage,
  DirectusImprintPage,
  DirectusLoginPage,
  DirectusMeetupItem,
  DirectusConferenceItem,
  DirectusMeetupPage,
  DirectusMemberItem,
  DirectusPickOfTheDayItem,
  DirectusPickOfTheDayPage,
  DirectusPodcastItem,
  DirectusPodcastPage,
  DirectusPrivacyPage,
  DirectusProfileCreationPage,
  DirectusRafflePage,
  DirectusRecordingsPage,
  DirectusSpeakerItem,
  DirectusTagItem,
  DirectusProfileItem,
  DirectusTranscriptItem,
  DirectusTestimonialItem,
  DirectusCocktailMenu,
  DirectusRatingItem,
  DirectusTicketOrderItem,
  DirectusTicketItem,
  DirectusTicketDiscountCodeItem,
  DirectusAgbPage,
} from '../types';

export type Collections = {
    home_page: DirectusHomePage
    podcast_page: DirectusPodcastPage
    meetup_page: DirectusMeetupPage
    conference_page: DirectusConferencePage
    hall_of_fame_page: DirectusHallOfFamePage
    pick_of_the_day_page: DirectusPickOfTheDayPage
    about_page: DirectusAboutPage
    contact_page: DirectusContactPage
    imprint_page: DirectusImprintPage
    privacy_page: DirectusPrivacyPage
    agb_page: DirectusAgbPage
    raffle_page: DirectusRafflePage
    login_page: DirectusLoginPage
    profile_creation_page: DirectusProfileCreationPage
    coc_page: DirectusCocPage
    recordings_page: DirectusRecordingsPage
    cocktail_menu: DirectusCocktailMenu
    podcasts: DirectusPodcastItem[]
    meetups: DirectusMeetupItem[]
    conferences: DirectusConferenceItem[]
    members: DirectusMemberItem[]
    speakers: DirectusSpeakerItem[]
    picks_of_the_day: DirectusPickOfTheDayItem[]
    profiles: DirectusProfileItem[]
    ratings: DirectusRatingItem[]
    tags: DirectusTagItem[]
    testimonials: DirectusTestimonialItem[]
    transcripts: DirectusTranscriptItem[]
    ticket_orders: DirectusTicketOrderItem[]
    tickets: DirectusTicketItem[]
    ticket_discount_codes: DirectusTicketDiscountCodeItem[]
}

export const directus = createDirectus<Collections>(DIRECTUS_CMS_URL)
    .with(authentication('session', { credentials: 'include' }))
    .with(rest())

// Statuses that indicate a transient upstream condition worth retrying.
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function isTransientError(error: unknown): boolean {
    // Directus SDK API errors carry the raw Response; network-level failures
    // (DNS, connection reset, timeout) surface as a TypeError without one.
    const status = (error as { response?: { status?: number } } | null)?.response?.status
    return status !== undefined ? TRANSIENT_STATUS_CODES.has(status) : error instanceof TypeError
}

// Build-time fetches are all reads, and a single failed request aborts the
// whole deploy (prerender.failOnError). Nitro's own prerender retry option is
// ineffective (it is passed to a plain fetch that ignores it), so transient
// failures are retried here with backoff instead. Retrying is opt-in via this
// function on purpose: at runtime this client also performs mutations that
// must not be re-sent.
let retriesEnabled = false

export function enableDirectusRetries(): void {
    if (retriesEnabled) {
        return
    }
    retriesEnabled = true

    const MAX_RETRIES = 3
    const baseRequest: typeof directus.request = directus.request.bind(directus)
    directus.request = (async (options: Parameters<typeof baseRequest>[0]) => {
        for (let attempt = 0; ; attempt++) {
            try {
                return await baseRequest(options)
            } catch (error) {
                if (attempt >= MAX_RETRIES || !isTransientError(error)) {
                    throw error
                }
                const delayMs = 1000 * 2 ** attempt
                console.warn(
                    `[directus] Transient request failure, retry ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms:`,
                    error
                )
                await new Promise((resolve) => setTimeout(resolve, delayMs))
            }
        }
    }) as typeof directus.request
}

// Prerendering only ever reads. The static guard keeps the wrapper out of the
// deployed server and client bundles. The route-discovery fetches in
// nuxt.config.ts run before prerendering in a separate module instance and
// opt in by calling enableDirectusRetries() themselves.
if (import.meta.prerender) {
    enableDirectusRetries()
}
