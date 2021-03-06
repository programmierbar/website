interface StrapiUpload {
  id: number;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  hash: string;
  size: number;
  url: string;
  previewUrl: null;
  provider: 'local' | 'google-cloud-storage';
  provider_metadata: null;
  created_at: string;
  updated_at: string;
}

export interface StrapiFile extends StrapiUpload {
  width: null;
  height: null;
  formats: null;
  ext: '.mp3';
  mime: 'audio/mpeg';
}

export interface StrapiImageFormat {
  ext: '.jpg' | '.png';
  url: string;
  hash: string;
  mime: 'image/jpeg' | 'image/png';
  name: string;
  path: null;
  size: number;
  width: number;
  height: number;
}

export interface StrapiImage extends StrapiUpload {
  width: number;
  height: number;
  formats: {
    xs?: StrapiImageFormat;
    sm?: StrapiImageFormat;
    md?: StrapiImageFormat;
    lg?: StrapiImageFormat;
    xl?: StrapiImageFormat;
  };
  ext: '.jpg' | '.png';
  mime: 'image/jpeg' | 'image/png';
}

export interface StrapiVideo extends StrapiUpload {
  width: number;
  height: number;
  ext: '.mp4';
  mime: 'video/mpeg';
}

interface StrapiTyp {
  id: number;
  created_at: string;
  updated_at: string;
  published_at: string;
}

export interface StrapiMember extends StrapiTyp {
  first_name: string;
  last_name: string;
  task_area: 'podcast_crew' | 'behind_the_scenes' | 'inactive';
  occupation: string;
  description: string;
  normal_image: StrapiImage;
  action_image: StrapiImage;
  position: number | null;
  podcasts: StrapiPodcast[];
  picks_of_the_day: StrapiPickOfTheDay[];
  tags: StrapiTag[];
}

export interface StrapiSpeaker extends StrapiTyp {
  academic_title: string;
  first_name: string;
  last_name: string;
  occupation: string;
  description: string;
  profile_image: StrapiImage;
  event_image: StrapiImage;
  twitter_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  github_url: string | null;
  website_url: string | null;
  position: number | null;
  podcasts: StrapiPodcast[];
  picks_of_the_day: StrapiPickOfTheDay[];
  tags: StrapiTag[];
}

export interface StrapiPodcast extends StrapiTyp {
  is_private: boolean;
  type: 'deep_dive' | 'cto_special' | 'news' | 'other';
  number: string;
  title: string;
  description: string;
  cover_image: StrapiImage;
  banner_image: StrapiImage | null;
  audio_file: StrapiFile;
  transcript: string | null;
  audio_url: string | null;
  apple_url: string | null;
  google_url: string | null;
  spotify_url: string | null;
  members: StrapiMember[];
  speakers: StrapiSpeaker[];
  picks_of_the_day: StrapiPickOfTheDay[];
  tags: StrapiTag[];
}

export interface StrapiMeetup extends StrapiTyp {
  title: string;
  start_at: string;
  end_at: string;
  description: string;
  cover_image: StrapiImage;
  gallery_images: StrapiImage[];
  youtube_url: string | null;
  meetup_url: string | null;
  members: StrapiMember[];
  speakers: StrapiSpeaker[];
  tags: StrapiTag[];
}

export interface StrapiPickOfTheDay extends StrapiTyp {
  name: string;
  description: string;
  website_url: string;
  image: StrapiImage;
  podcast: StrapiPodcast;
  member: number | null;
  speaker: number | null;
  tags: StrapiTag[];
}

export interface StrapiTag extends StrapiTyp {
  name: string;
}

export interface StrapiHomePage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  intro_text: string;
  podcast_heading: string;
  podcasts: StrapiPodcast[];
  video: StrapiVideo;
  news: string;
}

export interface StrapiPodcastPage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  cover_image: StrapiImage;
  intro_heading: string;
  intro_text_1: string;
  intro_text_2: string;
  deep_dive_heading: string;
  cto_special_heading: string;
  news_heading: string;
}

export interface StrapiMeetupPage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  cover_image: StrapiImage;
  intro_heading: string;
  intro_text_1: string;
  intro_text_2: string;
  corona_text: string;
  meetups_heading: string;
}

export interface StrapiHallOfFamePage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
}

export interface StrapiPickOfTheDayPage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  intro_heading: string;
  intro_text: string;
}

export interface StrapiAboutPage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  cover_image: StrapiImage;
  intro_text: string;
  podcast_crew_heading: string;
  behind_the_scenes_heading: string;
}

export interface StrapiContactPage extends StrapiTyp {
  meta_title: string;
  meta_description: string;
  intro_text: string;
  address_heading: string;
  address_text: string;
  business_heading: string;
  business_text: string;
}

export interface StrapiImprintPage extends StrapiTyp {
  text: string;
}

export interface StrapiPrivacyPage extends StrapiTyp {
  text: string;
}
