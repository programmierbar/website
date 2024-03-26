/* eslint-disable no-use-before-define */

import type { DirectusMeetupItem, DirectusPodcastItem, DirectusSpeakerItem } from '~/types/directus'

export type LatestPodcastItem = Pick<
    DirectusPodcastItem,
    'id' | 'slug' | 'published_on' | 'type' | 'number' | 'title' | 'cover_image' | 'audio_url'
>

export interface FileItem {
    id: string
    title: string | null
    type: string
    width: number | null
    height: number | null
}

interface PreparedTagsItem {
    tagsPrepared: TagItem[]
}

interface PreparedSpeakersItem {
    speakersPrepared: SpeakerPreviewItem[]
}
interface PreparedPodcastsItems {
    podcastsPrepared: PodcastPreviewItem[]
}

export interface PodcastItem extends DirectusPodcastItem, PreparedTagsItem, PreparedSpeakersItem {}
export interface MeetupItem extends DirectusMeetupItem, PreparedTagsItem, PreparedSpeakersItem {}
export interface SpeakerItem extends DirectusSpeakerItem, PreparedTagsItem, PreparedPodcastsItems {}

export interface MemberItem {
    id: string
    first_name: string
    last_name: string
    task_area: 'podcast_crew' | 'behind_the_scenes' | 'other'
    occupation: string
    description: string
    normal_image: FileItem
    action_image: FileItem
    meetups: MeetupItem[]
    podcasts: PodcastItem[]
    picks_of_the_day: PickOfTheDayItem[]
    tags: TagItem[]
}

export interface SpeakerPreviewItem {
    id: string
    slug: string
    academic_title: string
    first_name: string
    last_name: string
    profile_image: FileItem
    description: string
    event_image: FileItem
}

export interface PickOfTheDayItem extends PreparedTagsItem {
    id: string
    published_on: string
    name: string
    website_url: string
    description: string
    image: FileItem
    podcast: PodcastItem
    tags: TagItem[]
}

export interface TagItem {
    id: string
    name: string
    podcasts: PodcastItem[]
    meetups: MeetupItem[]
    picks_of_the_day: PickOfTheDayItem[]
    speakers: SpeakerItem[]
}

export interface PodcastPreviewItem {
    id: string
    slug: string
    published_on: string
    type: string
    number: string
    title: string
    cover_image: FileItem
    audio_url: string
}

export interface LoginProvider {
    name: string
    url: string
}
