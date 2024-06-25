import { WebClient } from "@slack/web-api";

// Create Slack web client instance
const webClient = new WebClient(process.env.SLACK_BOT_TOKEN as string);

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
    });
  } catch (error: any) {
    throw new Error(`Slack: ${error.message}`);
  }
}
