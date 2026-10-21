import { WebClient } from '@slack/web-api'

// Create Slack web client instance
const webClient = new WebClient(process.env.SLACK_BOT_TOKEN as string)

/**
 * Whether a bot token and channel are configured. Optional alerts (e.g. about a missing
 * setting) check this first, so environments without Slack stay quiet.
 */
export function isSlackConfigured(): boolean {
    return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID)
}

/**
 * A helper function that posts a Slack message to a specific channel.
 *
 * @param text The text to send.
 */
export async function postSlackMessage(text: string): Promise<void> {
    try {
        await webClient.chat.postMessage({
            channel: process.env.SLACK_CHANNEL_ID as string,
            text,
        })
    } catch (error: any) {
        throw new Error(`Slack: ${error.message}`)
    }
}
