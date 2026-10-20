import type { useHead } from '#app'
import {
    BUZZSPROUT_TRACKING_URL,
    DEFAULT_OG_IMAGE,
    TWITTER_HANDLE,
    WEBSITE_LOCALE,
    WEBSITE_NAME,
    WEBSITE_URL,
} from '../config'
import type { FileItem } from '../types'
import { getAssetUrl } from './getAssetUrl'
import { getTrimmedString } from './getTrimmedString'

type HeadInput = Parameters<typeof useHead>[0]
type MetaTag = { name: string; content: string } | { property: string; content: string }

interface Data {
    type: 'website' | 'podcast' | 'profile' | 'article'
    path: string
    title: string
    // Plain text. Convert CMS rich text with `getPlainText` from
    // `helpers/sanitize` first; it is not imported here because this module is
    // part of the helpers barrel, which server routes import.
    description?: string | null
    image?: FileItem | null
    // Absolute URL of an image hosted elsewhere, e.g. the Open Graph image of
    // a linked article. Only used if there is no `image`.
    externalImageUrl?: string | null
    audioUrl?: string
    publishedAt?: string
    firstName?: string
    lastName?: string
    noIndex?: boolean
}

interface OgImage {
    url: string
    alt: string
    type?: string
    width?: number
    height?: number
}

// Facebook and LinkedIn only show the large link preview for images that are at least this wide
const OG_IMAGE_WIDTH = 1200
const DESCRIPTION_MAX_LENGTH = 160

/**
 * Picks the image for the link preview: the page's own image, then an external
 * image, then the default image of the website.
 */
function getOgImage(title: string, image?: FileItem | null, externalImageUrl?: string | null): OgImage {
    if (image?.width && image.height) {
        // Never upscale, and keep the aspect ratio of the original
        const width = Math.min(image.width, OG_IMAGE_WIDTH)
        const height = Math.round((image.height / image.width) * width)
        return {
            url: getAssetUrl(image, { queryParams: { width, height, fit: 'cover', quality: 80 } }),
            // The file title in the CMS is derived from the file name, so it
            // doesn't describe the image. The page title does a better job.
            alt: title,
            type: image.type,
            width,
            height,
        }
    }

    if (externalImageUrl && /^https?:\/\//.test(externalImageUrl)) {
        return { url: externalImageUrl, alt: title }
    }

    return {
        url: WEBSITE_URL + DEFAULT_OG_IMAGE.path,
        alt: DEFAULT_OG_IMAGE.alt,
        type: DEFAULT_OG_IMAGE.type,
        width: DEFAULT_OG_IMAGE.width,
        height: DEFAULT_OG_IMAGE.height,
    }
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
    description,
    image,
    externalImageUrl,
    audioUrl,
    publishedAt,
    firstName,
    lastName,
    noIndex,
}: Data) {
    // Create URL of current site
    const siteUrl = WEBSITE_URL + path

    // Add website name to the document title of subpages. Search engines and
    // social networks shorten long titles themselves, so they are not trimmed.
    const pageTitle = title.trim()
    const documentTitle = path === '/' ? pageTitle : `${pageTitle} | ${WEBSITE_NAME}`

    // Replace multiple whitespace characters, including line breaks, with a
    // single space and trim the description at a word boundary
    const trimmedDescription = getTrimmedString((description ?? '').replace(/\s+/g, ' ').trim(), DESCRIPTION_MAX_LENGTH)

    const ogImage = getOgImage(pageTitle, image, externalImageUrl)

    // Create default meta info with Open Graph protocol and Twitter Cards
    const meta: MetaTag[] = [
        // Open Graph protocol
        {
            property: 'og:type',
            content: type === 'podcast' ? 'article' : type,
        },
        {
            property: 'og:site_name',
            content: WEBSITE_NAME,
        },
        {
            property: 'og:locale',
            content: WEBSITE_LOCALE,
        },
        {
            property: 'og:url',
            content: siteUrl,
        },
        {
            property: 'og:title',
            content: pageTitle,
        },
        {
            property: 'og:image',
            content: ogImage.url,
        },
        {
            property: 'og:image:alt',
            content: ogImage.alt,
        },

        // Twitter Cards
        {
            name: 'twitter:card',
            content: 'summary_large_image',
        },
        {
            name: 'twitter:site',
            content: TWITTER_HANDLE,
        },
        {
            name: 'twitter:title',
            content: pageTitle,
        },
        {
            name: 'twitter:image',
            content: ogImage.url,
        },
        {
            name: 'twitter:image:alt',
            content: ogImage.alt,
        },
    ]

    // Add image type and dimensions if known
    if (ogImage.type) {
        meta.push({ property: 'og:image:type', content: ogImage.type })
    }
    if (ogImage.width && ogImage.height) {
        meta.push(
            { property: 'og:image:width', content: ogImage.width.toString() },
            { property: 'og:image:height', content: ogImage.height.toString() }
        )
    }

    // Add description if available, as an empty one is worse than none
    if (trimmedDescription) {
        meta.push(
            { name: 'description', content: trimmedDescription },
            { property: 'og:description', content: trimmedDescription },
            { name: 'twitter:description', content: trimmedDescription }
        )
    }

    // Add audio to meta info if available
    if (audioUrl) {
        meta.push({
            property: 'og:audio',
            content: BUZZSPROUT_TRACKING_URL + '/' + audioUrl,
        })
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
                property: 'profile:first_name',
                content: firstName,
            },
            {
                property: 'profile:last_name',
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
        title: documentTitle,
        link: [{ rel: 'canonical', href: siteUrl }],
        meta,
    } satisfies HeadInput
}
