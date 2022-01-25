import type { FileItem, PodcastItem } from './items';

export interface HomePage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  video: FileItem;
  news: string[];
  podcast_heading: string;
  podcasts: Pick<
    PodcastItem,
    | 'id'
    | 'slug'
    | 'published_on'
    | 'type'
    | 'number'
    | 'title'
    | 'cover_image'
    | 'audio_url'
  >[];
}

export interface PodcastPage {
  meta_title: string;
  meta_description: string;
  cover_image: FileItem;
  intro_heading: string;
  intro_text_1: string;
  intro_text_2: string;
  deep_dive_heading: string;
  cto_special_heading: string;
  news_heading: string;
}

export interface MeetupPage {
  meta_title: string;
  meta_description: string;
  cover_image: FileItem;
  intro_heading: string;
  intro_text_1: string;
  intro_text_2: string;
  corona_text: string;
  meetup_heading: string;
}

export interface HallOfFamePage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
}

export interface PickOfTheDayPage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
}

export interface AboutPage {
  meta_title: string;
  meta_description: string;
  cover_image: FileItem;
  intro_text: string;
  podcast_crew_heading: string;
  behind_the_scenes_heading: string;
}

export interface ContactPage {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
  detail_text: string;
}

export interface ImprintPage {
  heading: string;
  text: string;
}

export interface PrivacyPage {
  heading: string;
  text: string;
}
