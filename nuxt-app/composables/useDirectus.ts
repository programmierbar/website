import {
  aggregate,
  createUser,
  readItems,
  readMe,
  readProviders,
  readSingleton,
  rest,
  type QueryFilter, createItem,
} from '@directus/sdk';
import type {
  ConferenceItem,
  DirectusMemberItem,
  DirectusPickOfTheDayItem, DirectusPodcastItem,
  DirectusProfileItem,
  DirectusTagItem,
  DirectusTranscriptItem,
  LoginProvider,
  MeetupItem,
  PodcastItem,
  PodcastPreviewItem,
  SpeakerItem,
  SpeakerPreviewItem,
  TagItem,
} from '~/types';
import { DIRECTUS_CMS_URL, WEBSITE_URL } from './../config'
// This import needs to be relative/file-based
// so that it can be resolved during the nuxt build process
import { directus, type Collections } from './../services'

const collectionWithTagsName = ['members', 'speakers', 'podcasts', 'meetups', 'picks_of_the_day'] as const
type CollectionWithTagsName = (typeof collectionWithTagsName)[number]
export type Tag = { name: string; count: number }
type DirectusTag = { tag: { id: string; name: string } }

export function useDirectus() {
    async function getHomepage() {
        return await directus.request(
            readSingleton('home_page', {
                fields: [
                  '*',
                  'video.*',
                  'highlights.*',
                  'highlights.item.*',
                  'highlights.item.cover_image.*',
                  'highlights.item.poster.*',
                ],
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

  async function getConferencePage() {
    return await directus.request(
      readSingleton('conference_page', {
        fields: ['*', 'cover_image.*', 'video.*'],
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

    async function getRafflePage() {
        return await directus.request(
            readSingleton('raffle_page', {
                fields: ['*'],
            })
        )
    }

    async function getLoginPage() {
        return await directus.request(
            readSingleton('login_page', {
                fields: ['*'],
            })
        )
    }

    async function getProfileCreationPage() {
        return await directus.request(
            readSingleton('profile_creation_page', {
                fields: ['*'],
            })
        )
    }

    async function getCocPage() {
        return await directus.request(
            readSingleton('coc_page', {
                fields: ['*'],
            })
        )
    }

    async function getRecordingsPage() {
      return await directus.request(
        readSingleton('recordings_page', {
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

    async function getCocktailMenu() {
      return await directus.request(
        readSingleton('cocktail_menu', {
          fields: ['*'],
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

    async function getPodcasts() {
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
                    'description',
                    'tags.tag.id',
                    'tags.tag.name',
                ],
                sort: ['-published_on'],
                limit: -1,
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
                            tagsPrepared: podcast.tags
                                .map((tag: any) => tag.tag)
                                .filter((tag: TagItem) => tag) as TagItem[],
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
                        'intro',
                        'description',
                        'cover_image.*',
                        'cover_image',
                        'gallery_images',
                        'gallery_images.sort',
                        'gallery_images.image.*',
                        'meetup_url',
                        'youtube_url',
                        'talks',
                        'talks.*',
                        'talks.talk.*',
                        'talks.talk.thumbnail.*',
                        'talks.talk.video_url',
                        'talks.talk.speakers.*',
                        'talks.talk.speakers.speaker',
                        'talks.talk.speakers.speaker.*',
                        'talks.talk.members.*',
                        'talks.talk.members.member',
                        'talks.talk.members.member.*',
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
                            talksPrepared: meetup.talks
                              .sort((a, b) => a.sort - b.sort)
                              .map((talk: any) => {
                              return talk.talk;
                            }),
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

  async function getConferenceBySlug(slug: string) {
    return await directus
      .request(
        readItems('conferences', {
          fields: [
            'id',
            'slug',
            'published_on',
            'start_on',
            'end_on',
            'title',
            'headline_1',
            'text_1',
            'cover_image.*',
            'cover_image',
            'poster',
            'poster.*',
            'gallery_images',
            'gallery_images.sort',
            'gallery_images.directus_files_id.*',
            'agenda',
            'talks',
            'talks.*',
            'talks.talk.*',
            'talks.talk.thumbnail.*',
            'talks.talk.video_url',
            'talks.talk.speakers.*',
            'talks.talk.speakers.speaker',
            'talks.talk.speakers.speaker.*',
            'talks.talk.members.*',
            'talks.talk.members.member',
            'talks.talk.members.member.*',
            'faqs',
            'speakers',
            'speakers.*',
            'speakers.speakers_id.*',
            'speakers.speakers_id.profile_image.*',
            'tickets',
            'tickets_url',
            'tickets_on_sale',
            'tickets_text',
            'partners',
            'partners.*',
            'partners.partner.*',
            'partners.partner.name',
            'partners.partner.url',
            'partners.partner.image.*'
          ],
          filter: { slug: { _eq: slug } },
          limit: 1,
        })
      )
      .then((result) => {
        const singleResult = result.pop() as unknown as ConferenceItem
        const speakersPrepared = singleResult.speakers.map((speaker: any) => {
              return {
                first_name: speaker.speakers_id.first_name,
                last_name: speaker.speakers_id.last_name,
                profile_image: speaker.speakers_id.profile_image,
                occupation: speaker.speakers_id.occupation,
                slug: speaker.speakers_id.slug,
                description: speaker.speakers_id.description,
                event_image: speaker.speakers_id.event_image,
                academic_title: speaker.speakers_id.academic_title,
                website_url: speaker.speakers_id.website_url,
                twitter_url: speaker.speakers_id.twitter_url,
                bluesky_url: speaker.speakers_id.bluesky_url,
                linkedin_url: speaker.speakers_id.linkedin_url,
                github_url: speaker.speakers_id.github_url,
                instagram_url: speaker.speakers_id.instagram_url,
                youtube_url: speaker.speakers_id.youtube_url,
              } as SpeakerPreviewItem
          })

        const talksPrepared = singleResult.talks
          .sort((a, b) => a.sort - b.sort)
          .map((talk: any) => {
          return talk.talk;
        });

        const partnersPrepared = singleResult.partners
          .sort((a, b) => a.sort - b.sort)
          .map((partner: any) => {
            return partner.partner;
          });

        return {
          ...singleResult,
          speakersPrepared,
          talksPrepared,
          partnersPrepared,
        };
      })
    }

  async function getTestimonials() {
    return await directus
      .request(
        readItems('testimonials', {
          fields: [
            'id',
            'weight',
            'text',
            'subtitle',
          ],
          limit: -1,
        })
      )
    }

    async function getSpeakerBySlug(slug: string) {
        return await directus
            .request(
                readItems('speakers', {
                    fields: [
                        'id',
                        'sort',
                        'slug',
                        'academic_title',
                        'first_name',
                        'last_name',
                        'occupation',
                        'description',
                        'profile_image.*',
                        'website_url',
                        'bluesky_url',
                        'twitter_url',
                        'linkedin_url',
                        'youtube_url',
                        'github_url',
                        'instagram_url',
                        'podcasts.podcast.id',
                        'podcasts.podcast.slug',
                        'podcasts.podcast.published_on',
                        'podcasts.podcast.type',
                        'podcasts.podcast.number',
                        'podcasts.podcast.title',
                        'podcasts.podcast.cover_image.*',
                        'podcasts.podcast.audio_url',
                        'picks_of_the_day.id',
                        'picks_of_the_day.name',
                        'picks_of_the_day.website_url',
                        'picks_of_the_day.description',
                        'picks_of_the_day.image.*',
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
                        .map((speaker) => ({
                            ...speaker,
                            tagsPrepared: speaker.tags
                                .map((tag: DirectusTag) => tag.tag)
                                .filter((tag: TagItem) => tag) as TagItem[],
                            podcastsPrepared: speaker.podcasts
                                .map((podcast: any) => podcast.podcast)
                                .filter((podcast: PodcastItem) => podcast) as PodcastPreviewItem[],
                        }))
                        .pop() as unknown as SpeakerItem
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
                query: {
                  filter: {'listed_hof': {'_eq': true}},
                }
            }),
        )

        return Number(result.pop()?.count)
    }

    async function getMeetups() {
        return await directus.request(
            readItems('meetups', {
                fields: [
                    'id',
                    'published_on',
                    'slug',
                    'start_on',
                    'end_on',
                    'title',
                    'description',
                    'cover_image.*',
                    'tags.tag.id',
                    'tags.tag.name',
                ],
                sort: ['-start_on'],
                limit: -1,
            })
        )
    }

    async function getConferences() {
      return await directus.request(
        readItems('conferences', {
          fields: [
            'id',
            'published_on',
            'slug',
            'start_on',
            'end_on',
            'title',
            'text_1',
            'poster.*',
          ],
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
                    'published_on',
                    'academic_title',
                    'first_name',
                    'last_name',
                    'occupation',
                    'description',
                    'profile_image.*',
                    'tags.tag.id',
                    'tags.tag.name',
                    'podcasts.podcast.type',
                ],
                limit: -1,
                sort: ['podcasts.podcast.type', 'sort', '-published_on'],
                filter: {'listed_hof': {'_eq': true}},
            })
        )
    }

    async function getAllTopTags() {
        const allTags: Tag[] = []
        for (const collection of collectionWithTagsName) {
            const tags = await getTopTagsForCollection(collection)
            allTags.push(...tags)
        }

        const tagCounts: { [key: string]: number } = {}
        for (const tag of allTags) {
            tagCounts[tag.name] = (tagCounts[tag.name] || 0) + tag.count
        }

        const tagsWithCounts: Tag[] = Object.keys(tagCounts).map((key) => ({
            name: key,
            count: tagCounts[key],
        }))

        return tagsWithCounts.sort((a, b) => b.count - a.count)
    }

    async function getTopTagsForCollection(collection: CollectionWithTagsName, limit: number = 25) {
        const tagCounts: { [key: string]: number } = {}
        const tagItems = (await directus.request(
            readItems(collection, { fields: ['tags.tag.name'], limit: -1 })
        )) as unknown as { tags: { tag: DirectusTagItem }[] }[]

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
                    'sort',
                    'normal_image.*',
                    'action_image.*',
                    'twitter_url',
                    'bluesky_url',
                    'linkedin_url',
                    'instagram_url',
                    'github_url',
                    'youtube_url',
                    'website_url',
                ],
                filter,
                sort: ['sort']
            })
        )
    }

    async function getPicksOfTheDay() {
        return await directus
            .request(
                readItems('picks_of_the_day', {
                    fields: [
                        'id',
                        'name',
                        'website_url',
                        'published_on',
                        'description',
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
            .then((result: DirectusPickOfTheDayItem[]) =>
                result.map((pickOfTheDay) => ({
                    ...pickOfTheDay,
                    tagsPrepared: pickOfTheDay.tags
                        .map((tag: DirectusTag) => tag.tag)
                        .filter((tag) => tag) as TagItem[],
                }))
            )
    }

  async function getProfileById(id: string) {
    return (await directus
      .request(
        readItems('profiles', {
          fields: [
            'id',
            'first_name',
            'last_name',
            'display_name',
            'description',
            'job_role',
            'job_employer',
            'profile_image.*'
          ],
          limit: 1,
          filter: { id: { _eq: id } },
        })
      ))?.pop() as unknown as DirectusProfileItem
  }

  async function getTranscriptForPodcast(podcast: PodcastItem) {
    return (await directus
      .request(
        readItems('transcripts', {
          fields: [
            'id',
            'service',
            'supported_features',
            'speakers',
            'raw_response',
          ],
          filter: {
            podcast : { id: { _eq: podcast.id} }
          },
          sort: ['-date_updated']
        })
      ))?.pop() as unknown as DirectusTranscriptItem
  }

  async function getSingleSignOnProviders() {
        const directusProviders = await directus.request(readProviders())

        const providers = directusProviders.map((directusProvider): LoginProvider => {
            // The `redirect` parameter of the login URL cannot be set randomly
            // Only values configured in the env var `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` are allowed
            const providerUrl = new URL(DIRECTUS_CMS_URL)
            providerUrl.pathname = `/auth/login/${directusProvider.name}`
            providerUrl.searchParams.set('redirect', WEBSITE_URL + '/login-callback')

            return {
                name: directusProvider.name,
                url: providerUrl.toString(),
            }
        })

        return providers
    }

    async function getCurrentUser() {
        try {
            console.log('Refreshing auth', await directus.refresh())

            const user = await directus.with(rest({ credentials: 'include' })).request(readMe())
            console.log('Current user', user)

            // Maybe add some persistence etc. here?
            return user
        } catch (e: unknown) {
            console.log('Error while reading current user', e)
        }
    }

    async function registerNewUser(email: string, password: string) {
        try {
            const result = await directus.request(createUser({ email, password }))
            console.log(result)
        } catch (e: unknown) {
            console.error('Error while registering new user', e)
            return e
        }
    }

  async function createRating(vote: "up" | "down", podcast: DirectusPodcastItem) {
    try {
      const result = await directus.request(createItem('ratings', {
        up_or_down: vote,
        target: [
          {
            target_collection: 'podcasts',
            target: podcast.id
          }
        ],
      }))

      return result;

    } catch (e: unknown) {
      console.error('Error while persisting new feedback', e)
      return e
    }
  }

    return {
        getHomepage,
        getPodcastPage,
        getMeetupPage,
        getConferencePage,
        getHallOfFamePage,
        getPicksOfTheDayPage,
        getAboutPage,
        getPrivacyPage,
        getRafflePage,
        getLoginPage,
        getProfileCreationPage,
        getCocPage,
        getRecordingsPage,
        getImprintPage,
        getContactPage,
        getCocktailMenu,
        getMembers,
        getLatestPodcasts,
        getPodcasts,
        getMeetups,
        getConferences,
        getSpeakers,
        getPodcastCount,
        getPickOfTheDayCount,
        getSpeakersCount,
        getPicksOfTheDay,
        getAllTopTags,
        getTopTagsForCollection,
        getPodcastBySlug,
        getMeetupBySlug,
        getConferenceBySlug,
        getSpeakerBySlug,
        getRelatedPodcasts,
        getTranscriptForPodcast,
        getSingleSignOnProviders,
        getCurrentUser,
        registerNewUser,
        getProfileById,
        getTestimonials,
        createRating,
    }
}
