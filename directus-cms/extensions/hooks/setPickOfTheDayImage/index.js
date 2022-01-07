const fs = require('fs');
const path = require('path');
const axios = require('axios').default;
const { getUrlSlug } = require('shared-code');
const postSlackMessage = require('../../../helpers/postSlackMessage');

const HOOK_NAME = 'setPickOfTheDayImage';

module.exports = (
  { filter },
  { env, exceptions: { BaseException }, logger, services: { FilesService } }
) => {
  /**
   * It handles the filter logic that sets the "image" field on
   * created or updated pick of the day items, if necessary.
   *
   * @param data The filter data.
   *
   * @returns The new payload.
   */
  async function handleFilter({ payload, metadata, context }) {
    try {
      // Log start info
      logger.info(`${HOOK_NAME} hook: Start filter function`);

      // If collection is "picks_of_the_day" and payload contain "website_url",
      // create screenshot of website and return payload with "image"
      if (metadata.collection === 'picks_of_the_day' && payload.website_url) {
        // Create browserless response variable
        let browserlessResponse;

        // Get screenshot from browserless API
        logger.info(`${HOOK_NAME} hook: Get screenshot from browserless`);
        try {
          browserlessResponse = await axios({
            method: 'post',
            url: `https://chrome.browserless.io/function?TOKEN=${env.BROWSERLESS_API_KEY}`,
            headers: {
              'Content-Type': 'application/json',
            },
            data: JSON.stringify({
              code: fs.readFileSync(
                path.resolve(__dirname, 'browserless.js'),
                'utf8'
              ),
              context: {
                url: payload.website_url,
              },
            }),
          });

          // If an error occurs, log it and inform team via Slack
        } catch (error) {
          console.log(error);
          logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
          await postSlackMessage(
            `Achtung: Der Screenshot für einen Pick of the Day konnte nicht automatisch erstellt werden. Der Screenshoot muss nun manuell über den folgenden Link hinzugefügt werden: ${
              process.env.PUBLIC_URL
            }admin/content/picks_of_the_day/${
              (metadata.keys && metadata.keys[0]) || ''
            }`
          );
        }

        // If request to browserless was successful, add "image" to payload
        if (browserlessResponse && browserlessResponse.status === 200) {
          // Create files service instance
          const filesService = new FilesService({
            accountability: context.accountability,
            schema: context.schema,
          });

          // Create file name
          const fileName = `${getUrlSlug(
            payload.website_url.replace(/https?:\/\//, '')
          )}.jpg`;

          // Upload image and set image ID
          logger.info(`${HOOK_NAME} hook: Upload screenshot`);
          const imageId = await filesService.uploadOne(
            Buffer.from(browserlessResponse.data, 'base64'),
            {
              type: 'image/jpeg',
              filename_download: fileName,
              storage: process.env.STORAGE_LOCATIONS.split(',')[0],
            }
          );

          // Return payload with image
          logger.info(
            `${HOOK_NAME} hook: Set "image" at ${
              metadata.keys && metadata.keys[0]
                ? `"${metadata.collection}" item with ID "${metadata.keys[0]}"`
                : `newly created "${metadata.collection}" item`
            }`
          );
          return {
            ...payload,
            image: imageId,
          };
        }
      }

      // Handle unknown errors
    } catch (error) {
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }

    // Otherwise just return payload
    return payload;
  }

  /**
   * It sets the "image" field on newly created
   * pick of the day items, if necessary.
   */
  filter('items.create', (payload, metadata, context) =>
    handleFilter({ payload, metadata, context })
  );

  /**
   * It sets the "image" field on updated pick
   * of the day items, if necessary.
   */
  filter('items.update', (payload, metadata, context) =>
    handleFilter({ payload, metadata, context })
  );
};
