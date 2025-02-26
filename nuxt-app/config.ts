// Feature Flags
export const FLAG_SHOW_LOGIN = Boolean(process.env.FLAG_SHOW_LOGIN?.toLowerCase() == 'true')
export const FLAG_SHOW_CONFERENCE_PAGE = Boolean(process.env.FLAG_SHOW_CONFERENCE_PAGE?.toLowerCase() == 'true')

// Website config
export const DEVTOOLS = Boolean(process.env.DEVTOOLS?.toLowerCase() == 'true')
export const DEV = Boolean(process.env.NUXT_ENV === 'development')

export const DIRECTUS_CMS_URL =
    (process.env.DIRECTUS_CMS_URL?.endsWith('/')
        ? process.env.DIRECTUS_CMS_URL.slice(0, -1)
        : process.env.DIRECTUS_CMS_URL) || 'https://admin.programmier.bar'
export const SEND_CONTACT_EMAIL_URL = '/api/email'
export const BUZZSPROUT_TRACKING_URL = 'https://op3.dev/e/https://www.podtrac.com/pts/redirect.mp3'

// programmier.bar
export const WEBSITE_URL = process.env.WEBSITE_URL || 'https://www.programmier.bar'
export const WEBSITE_NAME = 'programmier.bar'
export const TWITTER_HANDLE = '@programmierbar'

// External URLs
export const APPLE_PODCASTS_URL =
    'https://podcasts.apple.com/us/podcast/programmier-bar-der-podcast-f%C3%BCr-app-und-webentwicklung/id1371409964'
export const SPOTIFY_URL = 'https://open.spotify.com/show/0ik0sXv9paTQCeThcOLCCJ'
export const BUZZSPROUT_RSS_FEED_URL = 'https://feeds.buzzsprout.com/176239.rss'
export const YOUTUBE_PODCAST_URL = 'https://www.youtube.com/playlist?list=PLdL7w42vTISATGJPlvPa91GEMOSHqbWZY'
export const MEETUP_URL = 'https://www.meetup.com/programmierbar'
export const GOOGLE_MAPS_URL = 'https://goo.gl/maps/7h8a14WPPQkQL4LB8'

export const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX || 'programmierbar_website_prod'

// Event IDs
export const PLAY_PODCAST_EVENT_ID = 'PLAY_PODCAST';
export const PAUSE_PODCAST_EVENT_ID = 'PAUSE_PODCAST';
export const OPEN_SPOTIFY_EVENT_ID = 'OPEN_SPOTIFY';
export const OPEN_APPLE_PODCASTS_EVENT_ID = 'OPEN_APPLE_PODCASTS';
export const OPEN_RSS_FEED_EVENT_ID = 'OPEN_RSS_FEED';
export const OPEN_YOUTUBE_PODCAST_URL_EVENT_ID = 'OPEN_YOUTUBE_PODCAST_URL';
export const DOWNLOAD_PODCAST_EVENT_ID = 'DOWNLOAD_PODCAST';
export const OPEN_MASTODON_EVENT_ID = 'OPEN_MASTODON';
export const OPEN_LINKEDIN_EVENT_ID = 'OPEN_LINKEDIN';
export const OPEN_TWITTER_EVENT_ID = 'OPEN_TWITTER';
export const OPEN_BLUESKY_EVENT_ID = 'OPEN_BLUESKY';
export const OPEN_GITHUB_EVENT_ID = 'OPEN_GITHUB';
export const OPEN_MEETUP_EVENT_ID = 'OPEN_MEETUP';
export const OPEN_YOUTUBE_EVENT_ID = 'OPEN_YOUTUBE';
export const OPEN_INSTAGRAM_EVENT_ID = 'OPEN_INSTAGRAM';
export const OPEN_SPEAKER_WEBSITE_EVENT_ID = 'OPEN_SPEAKER_WEBSITE';
export const OPEN_SPEAKER_GITHUB_EVENT_ID = 'OPEN_SPEAKER_GITHUB';
export const OPEN_SPEAKER_YOUTUBE_EVENT_ID = 'OPEN_SPEAKER_YOUTUBE';
export const OPEN_SPEAKER_INSTAGRAM_EVENT_ID = 'OPEN_SPEAKER_INSTAGRAM';
export const OPEN_SPEAKER_TWITTER_EVENT_ID = 'OPEN_SPEAKER_TWITTER';
export const OPEN_SPEAKER_LINKEDIN_EVENT_ID = 'OPEN_SPEAKER_LINKEDIN';
export const OPEN_SPEAKER_BLUESKY_EVENT_ID = 'OPEN_SPEAKER_BLUESKY';
export const OPEN_TAG_FILTER_EVENT_ID = 'OPEN_TAG_FILTER';
export const CLOSE_TAG_FILTER_EVENT_ID = 'CLOSE_TAG_FILTER';
export const ADD_TAG_FILTER_EVENT_ID = 'ADD_TAG_FILTER';
export const REMOVE_TAG_FILTER_EVENT_ID = 'REMOVE_TAG_FILTER';
export const START_DISCOVER_EFFECT_EVENT_ID = 'START_DISCOVER_EFFECT';
export const START_MAGNET_EFFECT_EVENT_ID = 'START_MAGNET_EFFECT';
export const OPEN_GOOGLE_CALENDAR_EVENT_EVENT_ID = 'OPEN_GOOGLE_CALENDAR_EVENT';
export const DOWNLOAD_CALEDNAR_EVENT_EVENT_ID = 'DOWNLOAD_CALENDAR_EVENT';
export const OPEN_MENU_EVENT_ID = 'OPEN_MENU';
export const CLOSE_MENU_EVENT_ID = 'CLOSE_MENU';
export const OPEN_SEARCH_EVENT_ID = 'OPEN_SEARCH';
export const CLOSE_SEARCH_EVENT_ID = 'CLOSE_SEARCH';
export const CLICK_SCROLL_DOWN_MOUSE_EVENT_ID = 'CLICK_SCROLL_DOWN_MOUSE';
export const CLICK_SCROLL_LEFT_ARROW_EVENT_ID = 'CLICK_SCROLL_LEFT_ARROW';
export const CLICK_SCROLL_RIGHT_ARROW_EVENT_ID = 'CLICK_SCROLL_RIGHT_ARROW';
export const OPEN_PICK_OF_THE_DAY_EVENT_ID = 'OPEN_PICK_OF_THE_DAY';
export const SEND_CONTACT_FORM_EVENT_ID = 'SEND_CONTACT_FORM';
export const OPEN_GOOGLE_MAPS_EVENT_ID = 'OPEN_GOOGLE_MAPS';
