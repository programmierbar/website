/* eslint-disable no-use-before-define */

export interface FileItem {
  id: string;
  title: string | null;
  type: string;
  width: number | null;
  height: number | null;
}

export interface PodcastItem {
  id: string;
  slug: string;
  published_on: string;
  type: 'deep_dive' | 'cto_special' | 'news' | 'other';
  number: string;
  title: string;
  cover_image: FileItem;
  banner_image: FileItem | null;
  audio_url: string;
  description: string;
  transcript: string | null;
  apple_url: string;
  google_url: string;
  spotify_url: string;
  members: MemberItem[];
  speakers: SpeakerItem[];
  tags: TagItem[];
}

export interface MeetupItem {
  id: string;
  slug: string;
  published_on: string;
  start_on: string;
  end_on: string;
  cover_image: FileItem;
  title: string;
  description: string;
  meetup_url: string;
  youtube_url: string | null;
  gallery_images: FileItem[];
  members: MemberItem[];
  speakers: SpeakerItem[];
  tags: TagItem[];
}

export interface MemberItem {
  id: string;
  first_name: string;
  last_name: string;
  task_area: 'podcast_crew' | 'behind_the_scenes' | 'other';
  occupation: string;
  description: string;
  normal_image: FileItem;
  action_image: FileItem;
  meetups: MeetupItem[];
  podcasts: PodcastItem[];
  picks_of_the_day: PickOfTheDayItem[];
  tags: TagItem[];
}

export interface SpeakerItem {
  id: string;
  sort: number;
  slug: string;
  published_on: string;
  academic_title: string | null;
  occupation: string;
  first_name: string;
  last_name: string;
  description: string;
  profile_image: FileItem;
  event_image: FileItem;
  website_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  meetups: MeetupItem[];
  podcasts: PodcastItem[];
  picks_of_the_day: PickOfTheDayItem[];
  tags: TagItem[];
}

export interface PickOfTheDayItem {
  id: string;
  published_on: string;
  name: string;
  website_url: string;
  description: string;
  image: FileItem;
  podcast: PodcastItem;
  tags: TagItem[];
}

export interface TagItem {
  id: string;
  name: string;
  podcasts: PodcastItem[];
  meetups: MeetupItem[];
  picks_of_the_day: PickOfTheDayItem[];
  speakers: SpeakerItem[];
}
