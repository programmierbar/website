import { aggregate, readItems, readSingleton, type QueryFilter } from '@directus/sdk'
import { directus, type Collections } from '~/services'
import type { DirectusMemberItem, DirectusPodcastItem } from '~/types'

export type LatestPodcasts = Pick<
    DirectusPodcastItem,
    'id' | 'slug' | 'published_on' | 'type' | 'number' | 'title' | 'cover_image' | 'audio_url'
>[]

export function useDirectus() {
    async function getHomepage() {
        return await directus.request(
            readSingleton('home_page', {
                fields: ['*', 'video.*'],
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

    async function getLatestPodcasts() {
        return await directus.request(
            readItems('podcasts', {
                fields: ['id', 'slug', 'published_on', 'type', 'number', 'title', 'cover_image.*', 'audio_url'],
                sort: ['-published_on'],
                limit: 10,
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
        getPicksOfTheDayPage,
        getAboutPage,
        getPrivacyPage,
        getImprintPage,
        getContactPage,
        getMembers,
        getLatestPodcasts,
        getPodcastCount,
        getPicksOfTheDay,
    }
}
