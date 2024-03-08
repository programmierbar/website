import { aggregate, readItems, readSingleton, type QueryFilter } from '@directus/sdk'
import { directus, type Collections } from '~/services'
import type {
    DirectusMemberItem,
    DirectusPodcastItem,
    MeetupItem,
    PodcastItem,
    SpeakerPreviewItem,
    TagItem,
} from '~/types'

export type LatestPodcasts = Pick<
    DirectusPodcastItem,
    'id' | 'slug' | 'published_on' | 'type' | 'number' | 'title' | 'cover_image' | 'audio_url'
>[]
export type CollectionName = 'members' | 'speakers' | 'tags' | 'podcasts' | 'meetups' | 'picks_of_the_day'
export type Tag = { name: string; count: number }
export type DirectusTag = { tag: { id: string; name: string } }

export function useDirectus() {
    async function getHomepage() {
        return await directus.request(
            readSingleton('home_page', {
                fields: ['*', 'video.*'],
            })
        )
    }

    async function getPodcastPage() {
        return await directus.request(
            readSingleton('podcast_page', {
                fields: ['*', 'cover_image.*'],
            })
        )
    }

    async function getMeetupPage() {
        return await directus.request(
            readSingleton('meetup_page', {
                fields: ['*', 'cover_image.*'],
            })
        )
    }

    async function getHallOfFamePage() {
        return await directus.request(
            readSingleton('hall_of_fame_page', {
                fields: ['*'],
            })
        )
    }

    async function getAboutPage() {
        return await directus.request(
            readSingleton('about_page', {
                fields: ['*', 'cover_image.*'],
            })
        )
    }

    async function getPrivacyPage() {
        return await directus.request(
            readSingleton('privacy_page', {
                fields: ['*'],
            })
        )
    }

    async function getImprintPage() {
        return await directus.request(
            readSingleton('imprint_page', {
                fields: ['*'],
            })
        )
    }

    async function getContactPage() {
        return await directus.request(
            readSingleton('contact_page', {
                fields: ['*'],
            })
        )
    }

    async function getPicksOfTheDayPage() {
        return await directus.request(
            readSingleton('pick_of_the_day_page', {
                fields: ['*', 'cover_image.*'],
            })
        )
    }

    async function getLatestPodcasts(limit: number = 10) {
        return await directus.request(
            readItems('podcasts', {
                fields: [
                    'id',
                    'slug',
                    'published_on',
                    'type',
                    'number',
                    'title',
                    'cover_image.*',
                    'audio_url',
                    'tags.tag.id',
                    'tags.tag.name',
                ],
                sort: ['-published_on'],
                limit: limit,
            })
        )
    }

    async function getRelatedPodcasts(podcast: PodcastItem | MeetupItem, limit: number = 15) {
        return await directus.request(
            readItems('podcasts', {
                fields: ['id', 'slug', 'published_on', 'type', 'number', 'title', 'cover_image.*', 'audio_url'],
                filter: {
                    _and: [
                        {
                            id: {
                                _neq: podcast.id,
                            },
                        },
                        {
                            tags: {
                                tag: {
                                    name: {
                                        _in: podcast.tagsPrepared.map((tag) => tag.name),
                                    },
                                },
                            },
                        },
                    ],
                } as any,
                sort: ['-published_on'],
                limit: limit,
            })
        )
    }

    async function getPodcastBySlug(slug: string) {
        return await directus
            .request(
                readItems('podcasts', {
                    fields: [
                        'id',
                        'published_on',
                        'type',
                        'number',
                        'title',
                        'slug',
                        'description',
                        'transcript',
                        'cover_image',
                        'cover_image.*',
                        'banner_image',
                        'banner_image.*',
                        'audio_url',
                        'apple_url',
                        'google_url',
                        'spotify_url',
                        'speakers',
                        'speakers.speaker.id',
                        'speakers.speaker.slug',
                        'speakers.speaker.academic_title',
                        'speakers.speaker.occupation',
                        'speakers.speaker.first_name',
                        'speakers.speaker.last_name',
                        'speakers.speaker.description',
                        'speakers.speaker.event_image.*',
                        'speakers.speaker.profile_image.*',
                        'members',
                        'members.member.id',
                        'members.member.first_name',
                        'members.member.last_name',
                        'members.member.occupation',
                        'members.member.description',
                        'members.member.normal_image.*',
                        'picks_of_the_day',
                        'picks_of_the_day.id',
                        'picks_of_the_day.name',
                        'picks_of_the_day.website_url',
                        'picks_of_the_day.description',
                        'picks_of_the_day.image.*',
                        'tags',
                        'tags.tag.id',
                        'tags.tag.name',
                    ],
                    filter: { slug: { _eq: slug } },
                    limit: 1,
                })
            )
            .then(
                (result) =>
                    result
                        .map((podcast) => ({
                            ...podcast,
                            tagsPrepared: podcast.tags.map((tag: any) => tag.tag) as TagItem[],
                            speakersPrepared: podcast.speakers.map((speaker: any) => {
                                return {
                                    first_name: speaker.speaker.first_name,
                                    last_name: speaker.speaker.last_name,
                                    profile_image: speaker.speaker.profile_image,
                                    slug: speaker.speaker.slug,
                                    description: speaker.speaker.description,
                                    event_image: speaker.speaker.event_image,
                                    academic_title: speaker.speaker.academic_title,
                                }
                            }) as SpeakerPreviewItem[],
                        }))
                        .pop() as PodcastItem
            )
    }

    async function getMeetupBySlug(slug: string) {
        return await directus
            .request(
                readItems('meetups', {
                    fields: [
                        'id',
                        'slug',
                        'published_on',
                        'start_on',
                        'end_on',
                        'title',
                        'description',
                        'cover_image.*',
                        'cover_image',
                        'gallery_images',
                        'meetup_url',
                        'youtube_url',
                        'members',
                        'speakers',
                        'speakers.speaker.id',
                        'speakers.speaker.slug',
                        'speakers.speaker.academic_title',
                        'speakers.speaker.first_name',
                        'speakers.speaker.last_name',
                        'speakers.speaker.description',
                        'speakers.speaker.event_image.*',
                        'tags',
                        'tags.tag.id',
                        'tags.tag.name',
                    ],
                    filter: { slug: { _eq: slug } },
                    limit: 1,
                })
            )
            .then(
                (result) =>
                    result
                        .map((meetup) => ({
                            ...meetup,
                            tagsPrepared: meetup.tags.map((tag: DirectusTag) => tag.tag) as TagItem[],
                            speakersPrepared: meetup.speakers.map((speaker: any) => {
                                return {
                                    first_name: speaker.speaker.first_name,
                                    last_name: speaker.speaker.last_name,
                                    profile_image: speaker.speaker.profile_image,
                                    slug: speaker.speaker.slug,
                                    description: speaker.speaker.description,
                                    event_image: speaker.speaker.event_image,
                                    academic_title: speaker.speaker.academic_title,
                                }
                            }) as SpeakerPreviewItem[],
                        }))
                        .pop() as MeetupItem
            )
    }

    async function getPodcastCount() {
        const result = await directus.request(
            aggregate('podcasts', {
                aggregate: { count: '*' },
            })
        )

        return Number(result.pop()?.count)
    }

    async function getPickOfTheDayCount() {
        const result = await directus.request(
            aggregate('picks_of_the_day', {
                aggregate: { count: '*' },
            })
        )

        return Number(result.pop()?.count)
    }

    async function getSpeakersCount() {
        const result = await directus.request(
            aggregate('speakers', {
                aggregate: { count: '*' },
            })
        )

        return Number(result.pop()?.count)
    }

    async function getMeetups() {
        return await directus.request(
            readItems('meetups', {
                fields: ['id', 'slug', 'start_on', 'end_on', 'title', 'description', 'cover_image.*'],
                sort: ['-start_on'],
                limit: -1,
            })
        )
    }

    async function getSpeakers() {
        return await directus.request(
            readItems('speakers', {
                fields: [
                    'id',
                    'slug',
                    'academic_title',
                    'first_name',
                    'last_name',
                    'occupation',
                    'profile_image.*',
                    'tags.tag.id',
                    'tags.tag.name',
                ],
                limit: -1,
                sort: ['sort', '-published_on'],
            })
        )
    }

    async function getTopTagsForCollection(collection: CollectionName, limit: number = 25) {
        const tagCounts: { [key: string]: number } = {}
        const tagItems = await directus.request(readItems(collection, { fields: ['tags.tag.name'], limit: -1 }))

        for (const item of tagItems) {
            for (const tagContainer of item.tags) {
                const tag = tagContainer.tag
                if (tag) {
                    tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1
                }
            }
        }

        const tagsWithCounts: Tag[] = Object.keys(tagCounts).map((key) => ({
            name: key,
            count: tagCounts[key],
        }))
        const sortedTags = tagsWithCounts.sort((a, b) => b.count - a.count)

        return sortedTags.slice(0, limit)
    }

    async function getMembers(filter: QueryFilter<Collections, DirectusMemberItem>) {
        return await directus.request(
            readItems('members', {
                fields: [
                    'id',
                    'first_name',
                    'last_name',
                    'task_area',
                    'occupation',
                    'description',
                    'normal_image.*',
                    'action_image.*',
                ],
                filter,
            })
        )
    }

    async function getPicksOfTheDay() {
        return await directus.request(
            readItems('picks_of_the_day', {
                fields: [
                    'id',
                    'name',
                    'website_url',
                    'description',
                    'podcast.*',
                    'image.*',
                    'podcast.slug',
                    'podcast.type',
                    'podcast.number',
                    'podcast.title',
                    'tags.tag.id',
                    'tags.tag.name',
                ],
                limit: -1,
                sort: ['-published_on'],
            })
        )
    }

    return {
        getHomepage,
        getPodcastPage,
        getMeetupPage,
        getHallOfFamePage,
        getPicksOfTheDayPage,
        getAboutPage,
        getPrivacyPage,
        getImprintPage,
        getContactPage,
        getMembers,
        getLatestPodcasts,
        getMeetups,
        getSpeakers,
        getPodcastCount,
        getPickOfTheDayCount,
        getSpeakersCount,
        getPicksOfTheDay,
        getTopTagsForCollection,
        getPodcastBySlug,
        getMeetupBySlug,
        getRelatedPodcasts,
    }
}
