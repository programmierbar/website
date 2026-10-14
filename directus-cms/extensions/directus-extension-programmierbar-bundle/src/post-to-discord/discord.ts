import axios from 'axios'
import { htmlToText } from '../shared/html.ts'

/** programmier.bar brand color (#CFFF00) used as the embed's accent stripe. */
const EMBED_COLOR = 0xcfff00

// Discord embed limits (https://discord.com/developers/docs/resources/message#embed-object-embed-limits).
const MAX_TITLE_LENGTH = 256
const MAX_DESCRIPTION_LENGTH = 4096

type LoggerFunction = (message: string) => void

interface DiscordEmbedImage {
    url: string
}

interface DiscordEmbed {
    title: string
    url: string
    description?: string
    color: number
    image?: DiscordEmbedImage
    footer: { text: string }
}

interface DiscordWebhookPayload {
    content?: string
    embeds: DiscordEmbed[]
}

export interface NewsEmbedInput {
    /** The source link title — becomes the embed title. */
    title: string
    /** The editor's comment on the link — becomes the embed description. */
    comment?: string | null
    /** The external URL the news link points at. */
    link?: string | null
    /** The `news` slug, used to build the website news page URL. */
    slug?: string | null
    /** Base website URL (no trailing slash required). */
    websiteUrl: string
    /** Open Graph metadata of the source link, used for the embed image. */
    openGraph?: { image?: string } | null
    /** Full name of the member who contributed the link, if any. */
    memberName?: string | null
}

/**
 * Convert the rich-text HTML from `news_links.comment` into the Markdown that
 * Discord embed descriptions render. Discord does NOT render HTML, so raw tags
 * would otherwise show up as literal text.
 *
 * Links become masked Markdown links (`[text](url)`), list items become bullet
 * lines, and block-level tags become newlines; every other tag is dropped.
 */
export function htmlToDiscordText(html: string): string {
    // <a href="url">text</a> → [text](url); fall back to the bare URL when the
    // link has no visible text.
    return htmlToText(html, (href, text) => (text ? `[${text}](${href})` : href))
}

/** Trim a string to `max` characters, appending an ellipsis when it overflows. */
function truncate(value: string, max: number): string {
    if (value.length <= max) {
        return value
    }
    return `${value.slice(0, max - 1)}…`
}

/**
 * Build the Discord webhook payload for a freshly published news item.
 *
 * The embed links to the programmier.bar news page (`/news/<slug>`) when a slug
 * is available; if it is missing (e.g. an item published before the slug was
 * derived) it falls back to the external source link so the message is never a
 * dead link.
 */
export function buildNewsEmbed({
    title,
    comment,
    link,
    slug,
    websiteUrl,
    openGraph,
    memberName,
}: NewsEmbedInput): DiscordWebhookPayload {
    const base = websiteUrl.replace(/\/+$/, '')
    const targetUrl = slug ? `${base}/news/${slug}` : link

    if (!targetUrl) {
        throw new Error('Cannot build Discord embed: neither a news slug nor an external link is available')
    }

    const embed: DiscordEmbed = {
        title: truncate(title, MAX_TITLE_LENGTH),
        url: targetUrl,
        color: EMBED_COLOR,
        footer: { text: 'programmier.bar News' },
    }

    // Attribution line ("Meinung von …") after the comment, separated by a blank
    // line so it reads as its own note.
    const attribution = memberName?.trim() ? `_Meinung von ${memberName.trim()}_` : ''
    const description = [comment ? htmlToDiscordText(comment) : '', attribution].filter(Boolean).join('\n\n')
    if (description) {
        embed.description = truncate(description, MAX_DESCRIPTION_LENGTH)
    }

    if (openGraph?.image) {
        embed.image = { url: openGraph.image }
    }

    return {
        content: '📰 Neuer News-Beitrag',
        embeds: [embed],
    }
}

/**
 * Post a payload to a Discord channel via an incoming webhook.
 *
 * @param webhookUrl The Discord webhook URL.
 * @param payload The webhook payload (content and/or embeds).
 * @param options Logger for context.
 */
export async function postToDiscord(
    webhookUrl: string,
    payload: DiscordWebhookPayload,
    { logger }: { logger: { info: LoggerFunction; error: LoggerFunction } }
): Promise<void> {
    try {
        await axios({
            method: 'POST',
            url: webhookUrl,
            timeout: 10_000,
            headers: { 'Content-Type': 'application/json' },
            data: { ...payload, allowed_mentions: { parse: [] } },
        })
    } catch (error: any) {
        // Surface Discord's response body (rate limits, validation errors) so the
        // failure is actionable rather than a bare "Request failed".
        const detail = error?.response?.data ? JSON.stringify(error.response.data) : error?.message
        logger.error(`Discord webhook request failed: ${detail}`)
        throw new Error(`Discord: ${detail}`)
    }
}
