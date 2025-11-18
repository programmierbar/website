/* eslint-disable no-use-before-define */

import type { TalkItem, PartnerItem } from '~/types/items';

export interface DirectusFileItem {
    id: string
    title: string | null
    type: string
    width: number | null
    height: number | null
}

export interface DirectusPodcastItem {
    id: string
    slug: string
    published_on: string
    type: 'deep_dive' | 'cto_special' | 'news' | 'other'
    number: string
    title: string
    cover_image: DirectusFileItem
    banner_image: DirectusFileItem | null
    audio_url: string
    description: string
    transcript: string | null
    apple_url: string
    google_url: string
    spotify_url: string
    picks_of_the_day: (string | DirectusPickOfTheDayItem)[]
    members: (
        | number
        | {
              id: number
              podcast: string | DirectusPodcastItem
              member: string | DirectusMemberItem
              sort: number
          }
    )[]
    speakers: {
        id: number
        podcast: DirectusPodcastItem
        speaker: DirectusSpeakerItem
        sort: number
    }[]
    tags: {
        id: number
        podcast: DirectusPodcastItem
        tag: DirectusTagItem
        sort: number
    }[]
}

export interface DirectusMeetupItem {
    id: string
    slug: string
    published_on: string
    start_on: string
    end_on: string
    cover_image: DirectusFileItem
    title: string
    intro: string
    description: string
    meetup_url: string
    youtube_url: string | null
    talks: {
      talk: TalkItem
      sort: number
    }[]
    gallery_images: {
        id: number
        meetup: DirectusMeetupItem
        image: DirectusFileItem
        sort: number
    }[]
    members: {
        id: number
        meetup: DirectusMeetupItem
        member: DirectusMemberItem
        sort: number
    }[]
    speakers: {
        id: number
        meetup: DirectusMeetupItem
        speaker: DirectusSpeakerItem
        sort: number
    }[]
    tags: {
        id: number
        meetup: DirectusMeetupItem
        tag: DirectusTagItem
        sort: number
    }[]
}

export interface DirectusConferenceItem {
    id: string
    slug: string
    published_on: string
    start_on: string
    end_on: string
    cover_image: DirectusFileItem
    poster: DirectusFileItem
    title: string
    headline_1: string
    text_1: string
    talks: {
      talk: TalkItem
      sort: number
    }[]
    gallery_images: {
        directus_files_id: DirectusFileItem
        sort: number
    }[]
    members: {
        id: number
        meetup: DirectusMeetupItem
        member: DirectusMemberItem
        sort: number
    }[]
    speakers: {
        id: number
        meetup: DirectusMeetupItem
        speaker: DirectusSpeakerItem
        sort: number
    }[]
    agenda: {
      start: string
      end: string
      title: string
      subtitle: string
      track: string
      talk_identifier: string
    }[]
    faqs: {
      question: string
      answer: string
    }[],
    tickets : {
      price: string,
      title: string,
      subtitle: string,
      style: string,
    }[],
    tickets_text: string,
    tickets_url: string,
    tickets_on_sale: Boolean,
    partners: {
      partner: PartnerItem
      sort: number
    }[],
}

export interface DirectusTestimonialItem {
  id: string
  text: string
  subtitle: string
  weight: number
}

export interface DirectusMemberItem {
    id: string
    first_name: string
    last_name: string
    task_area: 'podcast_crew' | 'behind_the_scenes' | 'other'
    occupation: string
    description: string
    normal_image: string | DirectusFileItem
    action_image: string | DirectusFileItem
    website_url: string | null
    twitter_url: string | null
    bluesky_url: string | null
    linkedin_url: string | null
    github_url: string | null
    instagram_url: string | null
    youtube_url: string | null
    mastodon_url: string | null
    meetups: (
        | number
        | {
              id: number
              member: string | DirectusMemberItem
              meetup: string | DirectusMeetupItem
              sort: number
          }
    )[]
    podcasts: (
        | number
        | {
              id: number
              member: string | DirectusMemberItem
              podcast: string | DirectusPodcastItem
              sort: number
          }
    )[]
    picks_of_the_day: (string | DirectusPickOfTheDayItem)[]
    sort: number
    tags: (
        | number
        | {
              id: number
              member: string | DirectusMemberItem
              tag: string | DirectusTagItem
              sort: number
          }
    )[]
}

export interface DirectusSpeakerItem {
    id: string
    sort: number
    slug: string
    published_on: string
    academic_title: string | null
    occupation: string
    first_name: string
    last_name: string
    description: string
    profile_image: DirectusFileItem
    event_image: DirectusFileItem | null
    website_url: string | null
    twitter_url: string | null
    bluesky_url: string | null
    linkedin_url: string | null
    github_url: string | null
    instagram_url: string | null
    youtube_url: string | null
    meetups: {
        id: number
        speaker: DirectusSpeakerItem
        meetup: DirectusMeetupItem
        sort: number
    }[]
    podcasts: {
        id: number
        speaker: DirectusSpeakerItem
        podcast: DirectusPodcastItem
        sort: number
    }[]
    picks_of_the_day: (string | DirectusPickOfTheDayItem)[]
    tags: {
        id: number
        speaker: DirectusSpeakerItem
        tag: DirectusTagItem
        sort: number
    }[],
    listed_hof: boolean
}

export interface DirectusPickOfTheDayItem {
    id: string
    published_on: string
    name: string
    website_url: string
    description: string
    image: DirectusFileItem
    podcast: DirectusPodcastItem
    tags: (
        | number
        | {
              id: number
              speaker: DirectusSpeakerItem
              tag: DirectusTagItem
              sort: number
          }
    )[]
}

export interface DirectusTagItem {
    id: string
    name: string
    podcasts: (
        | number
        | {
              id: number
              podcast: string | DirectusPodcastItem
              tag: string | DirectusTagItem
              sort: number
          }
    )[]
    meetups: (
        | number
        | {
              id: number
              meetup: string | DirectusMeetupItem
              tag: string | DirectusTagItem
              sort: number
          }
    )[]
    picks_of_the_day: (
        | number
        | {
              id: number
              pick_of_the_day: string | DirectusPickOfTheDayItem
              tag: string | DirectusTagItem
              sort: number
          }
    )[]
    speakers: (
        | number
        | {
              id: number
              speaker: string | DirectusSpeakerItem
              tag: string | DirectusTagItem
              sort: number
          }
    )[]
}

export interface DirectusHomePage {
    meta_title: string
    meta_description: string
    intro_heading: string
    highlights_heading: string
    meetup_heading: string
    highlights: any[],
    video: DirectusFileItem
    news: { text: string }[]
    podcast_heading: string
}

export interface DirectusPodcastPage {
    meta_title: string
    meta_description: string
    cover_image: DirectusFileItem
    intro_heading: string
    intro_text_1: string
    intro_text_2: string
    deep_dive_heading: string
    cto_special_heading: string
    news_heading: string
    other_heading: string
}

export interface DirectusMeetupPage {
    meta_title: string
    meta_description: string
    cover_image: DirectusFileItem
    intro_heading: string
    intro_text_1: string
    intro_text_2: string
    corona_text: string
    meetup_heading: string
    meetup_heading_past: string
}

export interface DirectusConferencePage {
  meta_title: string
  meta_description: string
  cover_image: DirectusFileItem
  conference_heading: string
  intro_heading: string
  intro_text_1: string
  faqs_heading: string
  faqs_text_1: string
  faqs: {
    question: string
    answer: string
  }[]
}

export interface DirectusHallOfFamePage {
    meta_title: string
    meta_description: string
    intro_heading: string
    intro_text: string
}

export interface DirectusPickOfTheDayPage {
    meta_title: string
    meta_description: string
    intro_heading: string
    intro_text: string
}

export interface DirectusAboutPage {
    meta_title: string
    meta_description: string
    cover_image: DirectusFileItem
    intro_text: string
    podcast_crew_heading: string
    behind_the_scenes_heading: string
}

export interface DirectusContactPage {
    meta_title: string
    meta_description: string
    intro_heading: string
    intro_text: string
    detail_text: string
}

export interface DirectusImprintPage {
    heading: string
    text: string
}

export interface DirectusRafflePage {
    status: string
    heading: string
    text: string
}

export interface DirectusCocktailMenu {
  status: string
  menu: string
}

export interface DirectusLoginPage {
    heading: string
    text: string
}

export interface DirectusProfileCreationPage {
    heading: string
    intro_text: string
    emoji_heading: string
    emoji_text: string
    interests_heading: string
    interests_text: string
    profile_change_text: string
    creation_done_text: string
}

export interface DirectusCocPage {
    status: string
    heading: string
    text: string
}

export interface DirectusRecordingsPage {
  status: string
  heading: string
  text: string
}

export interface DirectusPrivacyPage {
    heading: string
    text: string
}
