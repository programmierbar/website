import { WebClient } from '@slack/web-api'
import type { Logger } from 'pino'

interface FetchSlackContextOptions {
    podcastType: string
    podcastTitle: string
    slackBotToken: string
    logger: Logger
    getSettingValue: (key: string) => Promise<string | null>
}

/**
 * Format a Slack message text: decode Slack link markup, remove user/channel mentions.
 */
function formatSlackText(text: string): string {
    let result = text
    // Slack URLs: <url|label> -> label (url)
    result = result.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2 ($1)')
    // Slack URLs without label: <url> -> url
    result = result.replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // Remove user mentions <@U...>
    result = result.replace(/<@[A-Z0-9]+>/g, '')
    // Channel mentions <#C...|name> -> #name
    result = result.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    return result.trim()
}

/**
 * Fetch messages from a single Slack channel (last 2 weeks), including thread replies.
 */
async function fetchChannelMessages(
    webClient: WebClient,
    channelId: string,
    oldestTimestamp: string,
    logger: Logger
): Promise<string[]> {
    const result = await webClient.conversations.history({
        channel: channelId,
        oldest: oldestTimestamp,
        limit: 200,
    })

    if (!result.messages || result.messages.length === 0) {
        return []
    }

    const formattedMessages: string[] = []

    // Process in chronological order (Slack returns newest first)
    const messages = [...result.messages].reverse()

    for (const msg of messages) {
        if (!msg.text || msg.bot_id) continue

        const text = formatSlackText(msg.text)
        if (!text) continue

        formattedMessages.push(text)

        // Fetch thread replies if this message has a thread
        if (msg.reply_count && msg.reply_count > 0 && msg.ts) {
            try {
                const threadResult = await webClient.conversations.replies({
                    channel: channelId,
                    ts: msg.ts,
                    limit: 100,
                })

                if (threadResult.messages && threadResult.messages.length > 1) {
                    // Skip first message (it's the parent, already added)
                    for (const reply of threadResult.messages.slice(1)) {
                        if (!reply.text || reply.bot_id) continue
                        const replyText = formatSlackText(reply.text)
                        if (replyText) {
                            formattedMessages.push(`  ↳ ${replyText}`)
                        }
                    }
                }
            } catch (threadErr: any) {
                logger.warn(`fetchSlackContext: Failed to fetch thread replies: ${threadErr?.message || threadErr}`)
            }
        }
    }

    return formattedMessages
}

/**
 * Fetch recent Slack messages as context for shownotes generation.
 * Only applies to 'news' type podcasts.
 *
 * The automation_settings value can contain multiple channel IDs separated by comma.
 * Returns a formatted string of messages, or null if not applicable/available.
 */
export async function fetchSlackContext(options: FetchSlackContextOptions): Promise<string | null> {
    const { podcastType, podcastTitle, slackBotToken, logger, getSettingValue } = options

    if (podcastType !== 'news') {
        return null
    }

    const isAiNews = podcastTitle.startsWith('AI')
    const settingKey = isAiNews ? 'slack_channel_ai_news' : 'slack_channel_news'

    const channelSetting = await getSettingValue(settingKey)

    if (!channelSetting) {
        logger.info(`fetchSlackContext: No Slack channel configured for setting '${settingKey}', skipping`)
        return null
    }

    const channelIds = channelSetting
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)

    if (channelIds.length === 0) {
        logger.info(`fetchSlackContext: No valid channel IDs in setting '${settingKey}', skipping`)
        return null
    }

    try {
        const webClient = new WebClient(slackBotToken)
        const twoWeeksAgo = String(Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000))

        const allMessages: string[] = []

        for (const channelId of channelIds) {
            try {
                const messages = await fetchChannelMessages(webClient, channelId, twoWeeksAgo, logger)
                if (messages.length > 0) {
                    allMessages.push(...messages)
                }
                logger.info(`fetchSlackContext: Fetched ${messages.length} messages from channel ${channelId}`)
            } catch (channelErr: any) {
                logger.warn(
                    `fetchSlackContext: Failed to fetch from channel ${channelId}: ${channelErr?.message || channelErr}`
                )
            }
        }

        if (allMessages.length === 0) {
            logger.info(`fetchSlackContext: No messages found in any configured channel`)
            return null
        }

        logger.info(`fetchSlackContext: Total ${allMessages.length} messages fetched from ${channelIds.length} channel(s)`)
        return allMessages.join('\n---\n')
    } catch (err: any) {
        logger.warn(`fetchSlackContext: Failed to fetch Slack messages: ${err?.message || err}`)
        return null
    }
}
