import {
  PodcastItem,
  MeetupItem,
  PickOfTheDayItem,
  SpeakerItem,
} from './items';

export interface PodcastSearchItem
  extends Pick<
    PodcastItem,
    | 'id'
    | 'slug'
    | 'published_on'
    | 'type'
    | 'number'
    | 'title'
    | 'description'
    | 'cover_image'
    | 'tags'
  > {
  item_type: 'podcast';
}

export interface MeetupSearchItem
  extends Pick<
    MeetupItem,
    | 'id'
    | 'slug'
    | 'published_on'
    | 'title'
    | 'description'
    | 'cover_image'
    | 'tags'
  > {
  item_type: 'meetup';
}

export interface PickOfTheDaySearchItem
  extends Pick<
    PickOfTheDayItem,
    | 'id'
    | 'published_on'
    | 'name'
    | 'website_url'
    | 'description'
    | 'image'
    | 'tags'
  > {
  item_type: 'pick_of_the_day';
}

export interface SpeakerSearchItem
  extends Pick<
    SpeakerItem,
    | 'id'
    | 'slug'
    | 'published_on'
    | 'academic_title'
    | 'first_name'
    | 'last_name'
    | 'description'
    | 'profile_image'
    | 'tags'
  > {
  item_type: 'speaker';
}

export type SearchItem =
  | PodcastSearchItem
  | MeetupSearchItem
  | PickOfTheDaySearchItem
  | SpeakerSearchItem;
