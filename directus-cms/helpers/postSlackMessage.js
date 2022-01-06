const { WebClient } = require('@slack/web-api');

// Create Slack web client instance
const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * A helper function that posts a Slack message to a specific channel.
 *
 * @param text The text to send.
 */
module.exports = async function postSlackMessage(text) {
  try {
    await webClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text,
    });
  } catch (error) {
    throw new Error(`Slack: ${error.message}`);
  }
};
