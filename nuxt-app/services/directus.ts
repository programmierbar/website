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
    DirectusTranscriptItem
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
    podcasts: DirectusPodcastItem[]
    meetups: DirectusMeetupItem[]
    conferences: DirectusConferenceItem[]
    members: DirectusMemberItem[]
    speakers: DirectusSpeakerItem[]
    picks_of_the_day: DirectusPickOfTheDayItem[]
    profiles: DirectusProfileItem[],
    tags: DirectusTagItem[]
    transcripts: DirectusTranscriptItem[]
}

export const directus = createDirectus<Collections>(DIRECTUS_CMS_URL)
    .with(authentication('session', { credentials: 'include' }))
    .with(rest())
