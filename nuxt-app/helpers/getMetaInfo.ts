import type { useHead } from '#app'
import { BUZZSPROUT_TRACKING_URL, DIRECTUS_CMS_URL, TWITTER_HANDLE, WEBSITE_NAME, WEBSITE_URL } from '../config'
import type { FileItem } from '../types'
import { getAssetUrl } from './getAssetUrl'
import { getTrimmedString } from './getTrimmedString'

type HeadInput = Parameters<typeof useHead>[0]
type MetaTag = { name: string; content: string } | { property: string; content: string }

interface Data {
    type: 'website' | 'podcast' | 'profile' | 'article'
    path: string
    title: string
    description?: string
    image?: FileItem
    audioUrl?: string
    publishedAt?: string
    firstName?: string
    lastName?: string
    noIndex?: boolean
}

/**
 * A helper function that returns a page's meta information,
 * including the Open Graph protocol and Twitter Cards.
 *
 * @param data The meta source data.
 *
 * @returns The meta info.
 */
export function getMetaInfo({
    type,
    path,
    title,
    description = '',
    image,
    audioUrl,
    publishedAt,
    firstName,
    lastName,
    noIndex,
}: Data) {
    // Create URL of current site
    const siteUrl = WEBSITE_URL + path

    // Trim title and add website name for subpages
    const trimmedTitle = path === '/' ? getTrimmedString(title, 60) : getTrimmedString(title, 40) + ' | ' + WEBSITE_NAME

    // Trim description, remove markdown, and replace multiple whitespace
    // characters, including line breaks, with a single space
    const trimmedDescription = getTrimmedString(description.replace(/<[^<>]+>/g, '').replace(/\s+/g, ' '), 160)

    // Create default meta info with title, description,
    // Open Graph protocol and Twitter Cards
    const meta: MetaTag[] = [
        {
            name: 'description',
            content: trimmedDescription,
        },

        // Open Graph protocol
        {
            property: 'og:type',
            content: type === 'podcast' ? 'article' : type,
        },
        {
            property: 'og:url',
            content: siteUrl,
        },
        {
            property: 'og:title',
            content: trimmedTitle,
        },
        {
            property: 'og:description',
            content: trimmedDescription,
        },

        // Twitter Cards
        {
            name: 'twitter:card',
            content: type === 'podcast' ? 'player' : 'summary',
        },
        {
            name: 'twitter:site',
            content: TWITTER_HANDLE,
        },
        {
            name: 'twitter:creator',
            content: TWITTER_HANDLE,
        },
        {
            name: 'twitter:title',
            content: trimmedTitle,
        },
        {
            name: 'twitter:description',
            content: trimmedDescription,
        },
    ]

    // Add image to meta info if available
    if (image && image.width && image.height) {
        const imageMinSize = 512
        const widthIsSmaller = image.width < image.height
        const imageWidth = widthIsSmaller ? Math.round((image.width / image.height) * imageMinSize) : imageMinSize
        const imageHeight = !widthIsSmaller ? Math.round((image.height / image.width) * imageMinSize) : imageMinSize
        const imageUrl = getAssetUrl(image, {
            queryParams: {
                width: imageWidth,
                height: imageHeight,
                fit: 'cover',
                quality: '70',
            },
        })
        meta.push(
            // Open Graph protocol
            {
                property: 'og:image',
                content: imageUrl,
            },
            {
                property: 'og:image:type',
                content: image.type,
            },
            {
                property: 'og:image:width',
                content: imageWidth.toString(),
            },
            {
                property: 'og:image:height',
                content: imageHeight.toString(),
            },

            // Twitter Cards
            {
                property: 'twitter:image',
                content: imageUrl,
            }
        )

        // Add alternative text if available
        if (image.title) {
            meta.push(
                // Open Graph protocol
                {
                    property: 'og:image:alt',
                    content: image.title,
                },

                // Twitter Cards
                {
                    property: 'twitter:image:alt',
                    content: image.title,
                }
            )
        }
    }

    // Add audio to meta info if available
    if (audioUrl) {
        const audioTrackingUrl = BUZZSPROUT_TRACKING_URL + '/' + audioUrl
        meta.push(
            // Open Graph protocol
            {
                property: 'og:audio',
                content: audioTrackingUrl,
            },

            // Twitter Cards
            {
                property: 'twitter:player',
                content: audioUrl.replace(/\.mp3$/, '') + '?client_source=twitter_card&player_type=full_screen',
            },
            {
                property: 'twitter:player:width',
                content: '500',
            },
            {
                property: 'twitter:player:height',
                content: '210',
            },
            {
                property: 'twitter:player:stream',
                content: audioTrackingUrl + '?client_source=twitter_card',
            }
        )
    }

    // Add published time of article and podcast to meta info if available
    if ((type === 'article' || type === 'podcast') && publishedAt) {
        meta.push({
            property: 'article:published_time',
            content: publishedAt,
        })
    }

    // Add first and last name of profile if available
    if (type === 'profile' && firstName && lastName) {
        meta.push(
            {
                property: 'og:profile:first_name',
                content: firstName,
            },
            {
                property: 'og:profile:last_name',
                content: lastName,
            }
        )
    }

    // Add noindex to meta info if available
    if (noIndex) {
        meta.push({
            name: 'robots',
            content: 'noindex, nofollow',
        })
    }

    // Return meta info
    return {
        title: trimmedTitle,
        link: [{ rel: 'canonical', href: siteUrl }],
        meta,
    } satisfies HeadInput
}
