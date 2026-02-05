import { authentication, createDirectus, rest } from '@directus/sdk'
import { DIRECTUS_CMS_URL } from '../config'
import type {
    DirectusAboutPage,
    DirectusCocktailMenu,
    DirectusCocPage,
    DirectusConferenceItem,
    DirectusConferencePage,
    DirectusContactPage,
    DirectusHallOfFamePage,
    DirectusHomePage,
    DirectusImprintPage,
    DirectusLoginPage,
    DirectusMeetupItem,
    DirectusMeetupPage,
    DirectusMemberItem,
    DirectusPickOfTheDayItem,
    DirectusPickOfTheDayPage,
    DirectusPodcastItem,
    DirectusPodcastPage,
    DirectusPrivacyPage,
    DirectusProfileCreationPage,
    DirectusProfileItem,
    DirectusRafflePage,
    DirectusRatingItem,
    DirectusRecordingsPage,
    DirectusSpeakerItem,
    DirectusTagItem,
    DirectusTestimonialItem,
    DirectusTicketItem,
    DirectusTicketOrderItem,
    DirectusTranscriptItem,
} from '../types'

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
}

export const directus = createDirectus<Collections>(DIRECTUS_CMS_URL)
    .with(authentication('session', { credentials: 'include' }))
    .with(rest())
