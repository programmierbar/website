import { MetaInfo } from 'vue-meta/types/vue-meta';
import removeMarkdown from 'remove-markdown';
import { StrapiImage } from 'shared-code';
import { getTrimmedString } from './getTrimmedString';

interface Data {
  type: 'website' | 'podcast' | 'profile' | 'article';
  path: string;
  title: string;
  description?: string;
  image?: StrapiImage;
  audioUrl?: string;
  publishedAt?: string;
  firstName?: string;
  lastName?: string;
  noIndex?: boolean;
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
}: Data): MetaInfo {
  // Create URL of current site
  const siteUrl = process.env.NUXT_ENV_WEBSITE_URL + path;

  // Trim title and add website name for subpages
  const trimmedTitle =
    path === '/'
      ? getTrimmedString(title, 60)
      : getTrimmedString(title, 40) + ' | ' + process.env.NUXT_ENV_WEBSITE_NAME;

  // Trim description, remove markdown, and replace multiple whitespace
  // characters, including line breaks, with a single space
  const trimmedDescription = getTrimmedString(
    removeMarkdown(description).replace(/\s+/g, ' '),
    160
  );

  // Create default meta info with title, description,
  // Open Graph protocol and Twitter Cards
  const metaInfo: MetaInfo = {
    title: trimmedTitle,
    link: [
      {
        hid: 'canonical',
        rel: 'canonical',
        href: siteUrl,
      },
    ],
    meta: [
      {
        hid: 'description',
        name: 'description',
        content: trimmedDescription,
      },

      // Open Graph protocol
      {
        hid: 'og:type',
        property: 'og:type',
        content: type === 'podcast' ? 'article' : type,
      },
      {
        hid: 'og:url',
        property: 'og:url',
        content: siteUrl,
      },
      {
        hid: 'og:title',
        property: 'og:title',
        content: trimmedTitle,
      },
      {
        hid: 'og:description',
        property: 'og:description',
        content: trimmedDescription,
      },

      // Twitter Cards
      {
        hid: 'twitter:card',
        name: 'twitter:card',
        content: type === 'podcast' ? 'player' : 'summary',
      },
      {
        hid: 'twitter:site',
        name: 'twitter:site',
        content: process.env.NUXT_ENV_TWITTER_HANDLE!,
      },
      {
        hid: 'twitter:creator',
        name: 'twitter:creator',
        content: process.env.NUXT_ENV_TWITTER_HANDLE!,
      },
      {
        hid: 'twitter:title',
        name: 'twitter:title',
        content: trimmedTitle,
      },
      {
        hid: 'twitter:description',
        name: 'twitter:description',
        content: trimmedDescription,
      },
    ],
  };

  // Add image to meta info if available
  if (image) {
    const imageUrl = image.formats.lg?.url || image.url;
    const imageType = image.formats.lg?.mime || image.mime;
    const imageWidth = (image.formats.lg?.width || image.width).toString();
    const imageHeight = (image.formats.lg?.height || image.height).toString();
    metaInfo.meta = metaInfo.meta?.concat([
      // Open Graph protocol
      {
        hid: 'og:image',
        property: 'og:image',
        content: imageUrl,
      },
      {
        hid: 'og:image:type',
        property: 'og:image:type',
        content: imageType,
      },
      {
        hid: 'og:image:width',
        property: 'og:image:width',
        content: imageWidth,
      },
      {
        hid: 'og:image:height',
        property: 'og:image:height',
        content: imageHeight,
      },

      // Twitter Cards
      {
        hid: 'twitter:image',
        property: 'twitter:image',
        content: imageUrl,
      },
    ]);

    // Add alternative text if available
    if (image.alternativeText) {
      metaInfo.meta = metaInfo.meta?.concat([
        // Open Graph protocol
        {
          hid: 'og:image:alt',
          property: 'og:image:alt',
          content: image.alternativeText,
        },

        // Twitter Cards
        {
          hid: 'twitter:image:alt',
          property: 'twitter:image:alt',
          content: image.alternativeText,
        },
      ]);
    }
  }

  // Add audio to meta info if available
  if (audioUrl) {
    const audioTrackingUrl =
      process.env.NUXT_ENV_BUZZSPROUT_TRACKING_URL + audioUrl;
    metaInfo.meta = metaInfo.meta?.concat([
      // Open Graph protocol
      {
        hid: 'og:audio',
        property: 'og:audio',
        content: audioTrackingUrl,
      },

      // Twitter Cards
      {
        hid: 'twitter:player',
        property: 'twitter:player',
        content:
          audioUrl.replace(/\.mp3$/, '') +
          'client_source=twitter_card&player_type=full_screen',
      },
      {
        hid: 'twitter:player:width',
        property: 'twitter:player:width',
        content: '500',
      },
      {
        hid: 'twitter:player:height',
        property: 'twitter:player:height',
        content: '210',
      },
      {
        hid: 'twitter:player:stream',
        property: 'twitter:player:stream',
        content: audioTrackingUrl + '?client_source=twitter_card',
      },
    ]);
  }

  // Add published time of article and podcast to meta info if available
  if ((type === 'article' || type === 'podcast') && publishedAt) {
    metaInfo.meta?.push({
      hid: 'article:published_time',
      property: 'article:published_time',
      content: publishedAt,
    });
  }

  // Add first and last name of profile if available
  if (type === 'profile' && firstName && lastName) {
    metaInfo.meta = metaInfo.meta?.concat([
      {
        hid: 'og:profile:first_name',
        property: 'og:profile:first_name',
        content: firstName,
      },
      {
        hid: 'og:profile:last_name',
        property: 'og:profile:last_name',
        content: lastName,
      },
    ]);
  }

  // Add noindex to meta info if available
  if (noIndex) {
    metaInfo.meta?.push({
      hid: 'robots',
      name: 'robots',
      content: 'noindex, nofollow',
    });
  }

  // Return meta info
  return metaInfo;
}
