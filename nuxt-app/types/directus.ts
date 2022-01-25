/* eslint-disable no-use-before-define */

export interface DirectusFileItem {
  id: string;
  title: string | null;
  type: string;
  width: number | null;
  height: number | null;
}

export interface DirectusPodcastItem {
  id: string;
  slug: string;
  published_on: string;
  type: 'deep_dive' | 'cto_special' | 'news' | 'other';
  number: string;
  title: string;
  cover_image: string | DirectusFileItem;
  banner_image: string | DirectusFileItem | null;
  audio_url: string;
  description: string;
  apple_url: string;
  google_url: string;
  spotify_url: string;
  members: (
    | number
    | {
        id: number;
        podcast: string | DirectusPodcastItem;
        member: string | DirectusMemberItem;
        sort: number;
      }
  )[];
  speakers: (
    | number
    | {
        id: number;
        podcast: string | DirectusPodcastItem;
        speaker: string | DirectusSpeakerItem;
        sort: number;
      }
  )[];
  tags: (
    | number
    | {
        id: number;
        podcast: string | DirectusPodcastItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
}

export interface DirectusMeetupItem {
  id: string;
  slug: string;
  published_on: string;
  start_on: string;
  end_on: string;
  cover_image: string | DirectusFileItem;
  title: string;
  description: string;
  meetup_url: string;
  youtube_url: string | null;
  gallery_images: (
    | number
    | {
        id: number;
        meetup: string | DirectusMeetupItem;
        image: string | DirectusFileItem;
        sort: number;
      }
  )[];
  members: (
    | number
    | {
        id: number;
        meetup: string | DirectusMeetupItem;
        member: string | DirectusMemberItem;
        sort: number;
      }
  )[];
  speakers: (
    | number
    | {
        id: number;
        meetup: string | DirectusMeetupItem;
        speaker: string | DirectusSpeakerItem;
        sort: number;
      }
  )[];
  tags: (
    | number
    | {
        id: number;
        meetup: string | DirectusMeetupItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
}

export interface DirectusMemberItem {
  id: string;
  first_name: string;
  last_name: string;
  task_area: 'podcast_crew' | 'behind_the_scenes' | 'other';
  occupation: string;
  description: string;
  normal_image: string | DirectusFileItem;
  action_image: string | DirectusFileItem;
  meetups: (
    | number
    | {
        id: number;
        member: string | DirectusMemberItem;
        meetup: string | DirectusMeetupItem;
        sort: number;
      }
  )[];
  podcasts: (
    | number
    | {
        id: number;
        member: string | DirectusMemberItem;
        podcast: string | DirectusPodcastItem;
        sort: number;
      }
  )[];
  picks_of_the_day: (string | DirectusPickOfTheDayItem)[];
  tags: (
    | number
    | {
        id: number;
        member: string | DirectusMemberItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
}

export interface DirectusSpeakerItem {
  id: string;
  sort: number;
  slug: string;
  published_on: string;
  academic_title: string | null;
  occupation: string;
  first_name: string;
  last_name: string;
  description: string;
  profile_image: string | DirectusFileItem;
  event_image: string | DirectusFileItem;
  website_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  meetups: (
    | number
    | {
        id: number;
        speaker: string | DirectusSpeakerItem;
        meetup: string | DirectusMeetupItem;
        sort: number;
      }
  )[];
  podcasts: (
    | number
    | {
        id: number;
        speaker: string | DirectusSpeakerItem;
        podcast: string | DirectusPodcastItem;
        sort: number;
      }
  )[];
  picks_of_the_day: (string | DirectusPickOfTheDayItem)[];
  tags: (
    | number
    | {
        id: number;
        speaker: string | DirectusSpeakerItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
}

export interface DirectusPickOfTheDayItem {
  id: string;
  published_on: string;
  name: string;
  website_url: string;
  description: string;
  image: string | DirectusFileItem;
  podcast: string | DirectusPodcastItem;
  tags: (
    | number
    | {
        id: number;
        pick_of_the_day: string | DirectusPickOfTheDayItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
}

export interface DirectusTagItem {
  id: string;
  name: string;
  podcasts: (
    | number
    | {
        id: number;
        podcast: string | DirectusPodcastItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
  meetups: (
    | number
    | {
        id: number;
        meetup: string | DirectusMeetupItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
  picks_of_the_day: (
    | number
    | {
        id: number;
        pick_of_the_day: string | DirectusPickOfTheDayItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
  speakers: (
    | number
    | {
        id: number;
        speaker: string | DirectusSpeakerItem;
        tag: string | DirectusTagItem;
        sort: number;
      }
  )[];
}

export interface DirectusHomePage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  video: string | DirectusFileItem;
  news: { text: string }[];
  podcast_heading: string;
  podcasts: (
    | number
    | {
        id: number;
        home_page: string | DirectusHomePage;
        podcast: string | DirectusPodcastItem;
        sort: number;
      }
  )[];
}

export interface DirectusPodcastPage {
  meta_title: string;
  meta_description: string;
  cover_image: string | DirectusFileItem;
  intro_heading: string;
  intro_text_1: string;
  intro_text_2: string;
  deep_dive_heading: string;
  cto_special_heading: string;
  news_heading: string;
}

export interface DirectusMeetupPage {
  meta_title: string;
  meta_description: string;
  cover_image: string | DirectusFileItem;
  intro_heading: string;
  intro_text_1: string;
  intro_text_2: string;
  corona_text: string;
  meetup_heading: string;
}

export interface DirectusHallOfFamePage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
}

export interface DirectusPickOfTheDayPage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
}

export interface DirectusAboutPage {
  meta_title: string;
  meta_description: string;
  cover_image: string | DirectusFileItem;
  intro_text: string;
  podcast_crew_heading: string;
  behind_the_scenes_heading: string;
}

export interface DirectusContactPage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
  detail_text: string;
}

export interface DirectusImprintPage {
  heading: string;
  text: string;
}

export interface DirectusPrivacyPage {
  heading: string;
  text: string;
}
