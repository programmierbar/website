import { default as axios } from 'axios';
import  postSlackMessage from './../../../helpers/postSlackMessage.js'
import { getFullPodcastTitle, getUrlSlug } from './../../../../shared-code';

/**
 * It creates or updates a podcast episode at Buzzsprout and returns its data.
 *
 * @param podcastData The podcast data.
 * @param actionData The action data.
 *
 * @returns The Buzzsprout episode data.
 */
export async function handleBuzzsprout(HOOK_NAME, podcastData, { payload, context }, {logger, ItemsService, env}) {
  // Create is creation boolean
  const isCreation = typeof podcastData.buzzsprout_id !== 'number';

  // Log start info
  logger.info(
    `${HOOK_NAME} hook: ${
      isCreation ? 'Create' : 'Update'
    } podcast episode at Buzzsprout`
  );

  // Create published on timestamp
  const publishedOn = podcastData.published_on || new Date().toISOString();

  // Create Buzzsprout data object
  const buzzsproutData = {};

  // Add "published_at", if necessary
  if (isCreation || payload.published_on) {
    buzzsproutData.published_at = publishedOn;
  }

  // Add "private", if necessary
  if (isCreation || payload.status) {
    buzzsproutData.private = podcastData.status === 'archived';
  }

  // Add "title" and "custom_url", if necessary
  if (isCreation || payload.type || payload.number || payload.title) {
    const fullPodcastTitle = getFullPodcastTitle(podcastData);
    buzzsproutData.title = fullPodcastTitle;
    buzzsproutData.custom_url = `https://www.programmier.bar/podcast/${getUrlSlug(
      fullPodcastTitle
    )}`;
  }

  // Add "description", if necessary
  if (
    isCreation ||
    payload.description ||
    payload.picks_of_the_day ||
    payload.type
  ) {
    buzzsproutData.description = `
        ${podcastData.description}
        ${
      podcastData.picks_of_the_day.length
        ? `
                <p><b>Picks of the Day:</b></p>
                <ul>
                  ${podcastData.picks_of_the_day
          .map((pickOfTheDay) => {
            const memberOrSpeaker =
              pickOfTheDay.member || pickOfTheDay.speaker;
            return `
                        <li>
                          ${
              memberOrSpeaker
                ? `${memberOrSpeaker.first_name}: `
                : ''
            }
                          <a href="${pickOfTheDay.website_url}">
                            ${pickOfTheDay.name}
                          </a>
                          –
                          ${pickOfTheDay.description.replace(/<\/?p>/g, '')}
                        </li>
                      `;
          })
          .join('')}
                </ul>
              `
        : ''
    }
        <br>
        <p>
          <b>Schreibt uns!</b><br>
          Schickt uns eure Themenwünsche und euer Feedback: <a href="mailto:podcast@programmier.bar">podcast@programmier.bar</a>
        </p>
        <p>
          <b>Folgt uns!</b><br>
          Bleibt auf dem Laufenden über zukünftige Folgen und virtuelle Meetups und beteiligt euch an Community-Diskussionen.
        </p>
        <p>
          <a href="https://twitter.com/programmierbar">Twitter</a><br>
          <a href="https://www.instagram.com/programmier.bar/">Instagram</a><br>
          <a href="https://www.facebook.com/programmier.bar/">Facebook</a><br>
          <a href="https://www.meetup.com/de-DE/programmierbar/events/">Meetup</a><br>
          <a href="https://www.youtube.com/c/programmierbar">YouTube</a>
        </p>
        ${
      podcastData.type === 'deep_dive' || podcastData.type === 'cto_special'
        ? '<p>Musik: <a href="https://open.spotify.com/track/67wagdqqdGsiWpDr0rHSqO?si=e41a9de9eb714a99">Hanimo</a></p>'
        : ''
    }
      `
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }

  // Add "artwork_url", if necessary
  if (isCreation || payload.cover_image) {
    buzzsproutData.artwork_url = `${env.PUBLIC_URL}assets/${podcastData.cover_image}`;
  }

  // Add "audio_url", if necessary
  if (isCreation || payload.audio_file) {
    buzzsproutData.audio_url = `${env.PUBLIC_URL}assets/${podcastData.audio_file}`;
  }

  // Add "tags", if necessary
  if (isCreation || payload.tags) {
    buzzsproutData.tags = podcastData.tags.map((tag) => tag.name).join(', ');
  }

  // Add other required fields for episode creation
  if (isCreation) {
    // Create podcast items service instance
    const podcastItemsService = new ItemsService('podcasts', {
      accountability: context.accountability,
      schema: context.schema,
    });

    // Get all podcast items of current year
    const currentYearPodcastItems = await podcastItemsService.readByQuery({
      filter: {
        _and: [
          {
            buzzsprout_id: {
              _nnull: true,
            },
          },
          {
            published_on: {
              _gte: `${new Date(
                publishedOn
              ).getFullYear()}-01-01T00:00:00.000Z`,
            },
          },
          {
            published_on: {
              _lt: `${
                new Date(publishedOn).getFullYear() + 1
              }-01-01T00:00:00.000Z`,
            },
          },
        ],
      },
    });

    // Add fields to Buzzsprout data
    buzzsproutData.explicit = false;
    buzzsproutData.email_user_after_audio_processed = true;
    buzzsproutData.episode_number = currentYearPodcastItems.length + 1;
    buzzsproutData.season_number = new Date(publishedOn).getFullYear() - 2019;
    buzzsproutData.artist = 'programmier.bar';
  }

  try {
    // Create or update podcast episode at Buzzsprout
    const buzzsproutResponse = await axios({
      method: isCreation ? 'POST' : 'PUT',
      url: `${env.BUZZSPROUT_API_URL}episodes${
        isCreation ? '' : `/${podcastData.buzzsprout_id}`
      }.json?api_token=${env.BUZZSPROUT_API_TOKEN}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(buzzsproutData),
    });

    // Throw error if the request was not successful
    if (
      buzzsproutResponse.status !== 200 &&
      buzzsproutResponse.status !== 201
    ) {
      throw new Error(
        `Buzzsprout replied with the status "${buzzsproutResponse.status}" and the text "${buzzsproutResponse.statusText}".`
      );
    }

    // Return data of Buzzsprout episode
    return buzzsproutResponse.data;

    // If an error occurs, log it and inform team via Slack
  } catch (error) {
    logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
    await postSlackMessage(
      `Achtung: Eine Podcastfolge konnte nicht automatisch zu Buzzsprout hinzugefügt werden. Beim nächsten Speichervorgang über den folgenden Link, wird der Vorgang wiederholt: ${process.env.PUBLIC_URL}admin/content/podcasts/${podcastData.id}`
    );
  }
}
