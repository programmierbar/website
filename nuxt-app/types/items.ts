/* eslint-disable no-use-before-define */

import type { DirectusMeetupItem, DirectusPodcastItem, DirectusSpeakerItem } from '~/types/directus'

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
    podcastPrepared: any[]
}

interface PreparedMeetupsItems {
    meetupsPrepared: any[]
}

export interface PodcastItem extends DirectusPodcastItem, PreparedTagsItem, PreparedSpeakersItem {}
export interface MeetupItem extends DirectusMeetupItem, PreparedTagsItem, PreparedSpeakersItem {}
export interface SpeakerItem extends DirectusSpeakerItem, PreparedTagsItem {}

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

export interface PickOfTheDayItem {
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
