import { createDirectus, rest } from '@directus/sdk';
import { DIRECTUS_CMS_URL } from '../config';
import type {
  DirectusAboutPage,
  DirectusContactPage,
  DirectusHallOfFamePage,
  DirectusHomePage,
  DirectusImprintPage,
  DirectusMeetupItem,
  DirectusMeetupPage,
  DirectusMemberItem,
  DirectusPickOfTheDayItem,
  DirectusPickOfTheDayPage,
  DirectusPodcastItem,
  DirectusPodcastPage,
  DirectusPrivacyPage,
  DirectusSpeakerItem,
  DirectusTagItem,
} from '../types';

export type Collections = {
  home_page: DirectusHomePage;
  podcast_page: DirectusPodcastPage;
  meetup_page: DirectusMeetupPage;
  hall_of_fame_page: DirectusHallOfFamePage;
  pick_of_the_day_page: DirectusPickOfTheDayPage;
  about_page: DirectusAboutPage;
  contact_page: DirectusContactPage;
  imprint_page: DirectusImprintPage;
  privacy_page: DirectusPrivacyPage;
  podcasts: DirectusPodcastItem[];
  meetups: DirectusMeetupItem[];
  members: DirectusMemberItem[];
  speakers: DirectusSpeakerItem[];
  picks_of_the_day: DirectusPickOfTheDayItem[];
  tags: DirectusTagItem[];
};

export const directus =
  createDirectus<Collections>(DIRECTUS_CMS_URL).with(rest());
