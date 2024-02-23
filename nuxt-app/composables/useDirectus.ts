import { aggregate, readItems, readSingleton, type QueryFilter } from '@directus/sdk'
import { directus, type Collections } from '~/services'
import type { DirectusMemberItem, DirectusPodcastItem } from '~/types'

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

    async function getPodcastCount() {
        const result = await directus.request(
            aggregate('podcasts', {
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
        getPicksOfTheDay,
        getTopTagsForCollection,
    }
}
