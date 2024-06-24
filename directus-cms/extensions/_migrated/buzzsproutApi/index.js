const axios = require('axios').default;
const { getFullPodcastTitle, getUrlSlug } = require('../../../shared-code');

const HOOK_NAME = 'buzzsproutApi';

module.exports = (
  { action },
  { env, exceptions: { BaseException }, logger, services: { ItemsService } }
) => {
  /**
   * It creates or updates a podcast episode at Buzzsprout and returns its data.
   *
   * @param podcastData The podcast data.
   * @param actionData The action data.
   *
   * @returns The Buzzsprout episode data.
   */
  async function handleBuzzsprout(podcastData, { payload, context }) {
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

  /**
   * It adds the pick of the day and tag items to the podcast item object.
   *
   * @param podcastItem A podcast item.
   * @param actionData The action data.
   *
   * @returns The podcast data.
   */
  async function getPodcastData(podcastItem, { context }) {
    // Log start info
    logger.info(`${HOOK_NAME} hook: Query podcast data from Directus`);

    // Create member items service instance
    const memberItemsService = new ItemsService('members', {
      accountability: context.accountability,
      schema: context.schema,
    });

    // Create speaker items service instance
    const speakerItemsService = new ItemsService('speakers', {
      accountability: context.accountability,
      schema: context.schema,
    });

    // Create pick of the day items service instance
    const pickOfTheDayItemsService = new ItemsService('picks_of_the_day', {
      accountability: context.accountability,
      schema: context.schema,
    });

    // Log info
    logger.info(`${HOOK_NAME} hook: Query pick of the day items from Directus`);

    // Get pick of the day items with member or speaker
    const pickOfTheDayItems = await Promise.all(
      podcastItem.picks_of_the_day.map(async (pickOfTheDayId) => {
        const pickOfTheDay = await pickOfTheDayItemsService.readOne(
          pickOfTheDayId
        );
        return {
          ...pickOfTheDay,
          member:
            pickOfTheDay.member &&
            (await memberItemsService.readOne(pickOfTheDay.member)),
          speaker:
            pickOfTheDay.speaker &&
            (await speakerItemsService.readOne(pickOfTheDay.speaker)),
        };
      })
    );

    let tagItems = [];
    try {
      // Create podcast tag items service instance
      const podcastTagItemsService = new ItemsService('podcast_tags', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Create tag items service instance
      const tagItemsService = new ItemsService('tags', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Log info
      logger.info(`${HOOK_NAME} hook: Query tag items from Directus`);

      // Get tag items from tag item service by keys
      tagItems = await Promise.all(
        podcastItem.tags.map(async (podcastTagId) =>
          tagItemsService.readOne(
            (
              await podcastTagItemsService.readOne(podcastTagId)
            ).tag
          )
        )
      );
    } catch (error) {
      logger.error(
        `${HOOK_NAME} hook: Could not query tags "${error.message}"`
      );
    }

    // Return podcast data
    return {
      ...podcastItem,
      picks_of_the_day: pickOfTheDayItems,
      tags: tagItems,
    };
  }

  /**
   * It handles the podcast action and creates or updates
   * the podcast episode at Buzzsprout, if necessary.
   *
   * @param data The action data.
   */
  async function handlePodcastAction({ payload, metadata, context }) {
    try {
      // Log start info
      logger.info(
        `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
      );

      // Create podcast items service instance
      const podcastItemsService = new ItemsService('podcasts', {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get podcast item from podcast items service by key
      const podcastItem = await podcastItemsService.readOne(
        metadata.key || metadata.keys[0]
      );

      // Create is creation boolean
      const isCreation = typeof podcastItem.buzzsprout_id !== 'number';

      // If "buzzsprout_id" is not set and all required fields
      // are set, create a podcast episode at Buzzsprout
      const createdAndRequiredFieldsSet =
        isCreation &&
        podcastItem.status &&
        (podcastItem.status !== 'published' || podcastItem.published_on) &&
        podcastItem.type &&
        podcastItem.number &&
        podcastItem.title &&
        podcastItem.description &&
        podcastItem.cover_image &&
        podcastItem.audio_file;
      // Otherwise if "buzzsprout_id" is set and payload contains
      // relevant changes, update podcast episode at Buzzsprout
      const updatedWithRelevantFields =
        !isCreation &&
        (payload.status ||
          payload.published_on ||
          payload.type ||
          payload.number ||
          payload.title ||
          payload.description ||
          payload.cover_image ||
          payload.audio_file);

      // If podcast creation or update is not required, return
      if (!createdAndRequiredFieldsSet && !updatedWithRelevantFields) {
        logger.info(
          `${HOOK_NAME} hook: Podcast creation or update not required at Buzzsprout.`
        );
        return;
      }

      logger.info(
        `${HOOK_NAME} hook: Podcast creation or update required at Buzzsprout.`
      );

      // Get podcast data
      const podcastData = await getPodcastData(podcastItem, {
        context,
      });

      // Create or update Buzzsprout episode and get its data
      const buzzsproutData = await handleBuzzsprout(podcastData, {
        payload,
        context,
      });

      // Create update data object
      const updateData = {};

      // If "buzzsprout_id" it not set, add it to update data
      if (!podcastItem.buzzsprout_id) {
        logger.info(
          `${HOOK_NAME} hook: Set "buzzsprout_id" at "${
            metadata.collection
          }" item with ID "${metadata.key || metadata.keys[0]}"`
        );
        updateData.buzzsprout_id = buzzsproutData.id;
      }

      // If "audio_url" is not set or "audio_file", "type", "number"
      // or "title" changed, add "audio_url" to update data
      if (
        !podcastItem.audio_url ||
        payload.audio_file ||
        payload.type ||
        payload.number ||
        payload.title
      ) {
        logger.info(
          `${HOOK_NAME} hook: Set "audio_url" at "${
            metadata.collection
          }" item with ID "${metadata.key || metadata.keys[0]}"`
        );
        updateData.audio_url = buzzsproutData.audio_url;
      }

      // If No update data is set, return
      if (!Object.keys(updateData).length) {
        return;
      }

      // If update data contains something, update podcast item
      await podcastItemsService.updateOne(
        metadata.key || metadata.keys[0],
        updateData
      );

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }
  }

  /**
   * It creates the podcast episode at Buzzsprout on
   * newly created podcast items, if necessary.
   */
  action('podcasts.items.create', ({ payload, ...metadata }, context) =>
    handlePodcastAction({ payload, metadata, context })
  );

  /**
   * It creates or updates the podcast episode at Buzzsprout
   * on updated podcast items, if necessary.
   */
  action('podcasts.items.update', ({ payload, ...metadata }, context) =>
    handlePodcastAction({ payload, metadata, context })
  );

  /**
   * It handles the pick of the day action and updates the associated
   * podcast episode at Buzzsprout, if necessary.
   *
   * @param data The action data.
   */
  async function handlePickOfTheDayAction({ payload, metadata, context }) {
    try {
      // Log start info
      logger.info(
        `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
      );

      // If payload contains relevant changes,
      // get whole pick of the day item
      if (
        payload.name ||
        payload.website_url ||
        payload.description ||
        payload.podcast ||
        payload.member ||
        payload.speaker
      ) {
        // Create pick of the day items service instance
        const pickOfTheDayItemsService = new ItemsService('picks_of_the_day', {
          accountability: context.accountability,
          schema: context.schema,
        });

        // Get pick of the day item from pick of the day item service by key
        const pickOfTheDayItem = await pickOfTheDayItemsService.readOne(
          metadata.key || metadata.keys[0]
        );

        // If entry is associated with a podcast, get podcast item
        if (pickOfTheDayItem.podcast) {
          // Create podcast items service instance
          const podcastItemsService = new ItemsService('podcasts', {
            accountability: context.accountability,
            schema: context.schema,
          });

          // Get podcast item from podcast item service by key
          const podcastItem = await podcastItemsService.readOne(
            pickOfTheDayItem.podcast
          );

          // If "buzzsprout_id" is set, update podcast episode at Buzzsprout
          if (typeof podcastItem.buzzsprout_id === 'number') {
            // Get podcast data
            const podcastData = await getPodcastData(podcastItem, {
              context,
            });

            // Update Buzzsprout episode
            await handleBuzzsprout(podcastData, {
              payload: {
                picks_of_the_day: podcastItem.picks_of_the_day,
              },
              context,
            });
          }
        }
      }

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }
  }

  /**
   * It updates the podcast episode at Buzzsprout on newly
   * created pick of the day items, if necessary.
   */
  action('picks_of_the_day.items.create', ({ payload, ...metadata }, context) =>
    handlePickOfTheDayAction({ payload, metadata, context })
  );

  /**
   * It updates the podcast episode at Buzzsprout on
   * updated pick of the day items, if necessary.
   */
  action('picks_of_the_day.items.update', ({ payload, ...metadata }, context) =>
    handlePickOfTheDayAction({ payload, metadata, context })
  );

  /**
   * It handles the tag action and updates podcast
   * episodes at Buzzsprout, if necessary.
   *
   * @param data The action data.
   */
  async function handleTagAction({ payload, metadata, context }) {
    try {
      // Log start info
      logger.info(
        `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
      );

      // If payload contains relevant changes, get whole tag item
      if (payload.name || payload.podcasts) {
        // Create tag items service instance
        const tagItemsService = new ItemsService('tags', {
          accountability: context.accountability,
          schema: context.schema,
        });

        // Get tag item from tag item service by key
        const tagItem = await tagItemsService.readOne(
          metadata.key || metadata.keys[0]
        );

        // Create podcast tag items service instance
        const podcastTagItemsService = new ItemsService('podcast_tags', {
          accountability: context.accountability,
          schema: context.schema,
        });

        // Create podcast items service instance
        const podcastItemsService = new ItemsService('podcasts', {
          accountability: context.accountability,
          schema: context.schema,
        });

        // Get all podcast items async
        await Promise.all(
          tagItem.podcasts.map(async (podcastTagId) => {
            // Get podcast tag item from podcast tag item service by key
            const podcastTagItem = await podcastTagItemsService.readOne(
              podcastTagId
            );

            // Get podcast item from podcast item service by key
            const podcastItem = await podcastItemsService.readOne(
              podcastTagItem.podcast
            );

            // If "buzzsprout_id" is set, update podcast episode at Buzzsprout
            if (typeof podcastItem.buzzsprout_id === 'number') {
              // Get podcast data
              const podcastData = await getPodcastData(podcastItem, {
                context,
              });

              // Update Buzzsprout episode
              await handleBuzzsprout(podcastData, {
                payload: {
                  tags: podcastItem.tags,
                },
                context,
              });
            }
          })
        );
      }

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }
  }

  /**
   * It updates the podcast episode at Buzzsprout
   * on created tag items, if necessary.
   */
  action('tags.items.create', ({ payload, ...metadata }, context) =>
    handleTagAction({ payload, metadata, context })
  );

  /**
   * It updates the podcast episode at Buzzsprout
   * on updated tag items, if necessary.
   */
  action('tags.items.update', ({ payload, ...metadata }, context) =>
    handleTagAction({ payload, metadata, context })
  );
};
