const os = require('os');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { getUrlSlug } = require('shared-code');
const postSlackMessage = require('../../../helpers/postSlackMessage');

const HOOK_NAME = 'setPickOfTheDayImage';

module.exports = ({ filter }, { logger, services: { FilesService } }) => {
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
        // Create necessary variables
        let puppeteerBrowser, tmpFilePath, imageId;

        try {
          // Launch puppeteer browser
          logger.info(`${HOOK_NAME} hook: Puppeteer: Launch browser`);
          puppeteerBrowser = await puppeteer.launch();

          // Create new page and set viewport size
          logger.info(`${HOOK_NAME} hook: Puppeteer: Create new page`);
          const puppeteerPage = await puppeteerBrowser.newPage();
          await puppeteerPage.setViewport({ width: 1366, height: 768 });

          // Goto "website_url" and wait for content and animations
          logger.info(`${HOOK_NAME} hook: Puppeteer: Goto website`);
          await puppeteerPage.goto(payload.website_url, { timeout: 5000 });
          await puppeteerPage.content();
          await puppeteerPage.waitForTimeout(1000);

          // Try accepting cookies to hide cookie notice
          // by clicking on any suspicious button
          logger.info(`${HOOK_NAME} hook: Puppeteer: Accept cookies`);
          const cookiesAgreed = await puppeteerPage.evaluate(() => {
            let cookiesAgreed = false;
            if (document.body.textContent.match(/cookie/i)) {
              document
                .querySelectorAll('a, button, [type="button"], [type="submit"]')
                .forEach((element) => {
                  if (
                    [element.textContent, element.name, element.value].some(
                      (content) =>
                        typeof content === 'string' &&
                        content.match(
                          /(akzeptieren|verstanden|zustimmen|stimme zu|okay|^ok|accept|understand|agree|allow|enable|close)/i
                        )
                    )
                  ) {
                    element.click();
                    cookiesAgreed = true;
                  }
                });
            }
            return cookiesAgreed;
          });

          // If cookies have been agreed, reload page
          // and wait for content and animations
          if (cookiesAgreed) {
            logger.info(`${HOOK_NAME} hook: Puppeteer: Reload page`);
            await puppeteerPage.reload();
            await puppeteerPage.content();
            await puppeteerPage.waitForTimeout(1000);
          }

          // Create file name and temporary file path
          const fileName = `${getUrlSlug(
            payload.website_url.replace(/https?:\/\//, '')
          )}.jpg`;
          tmpFilePath = path.join(os.tmpdir(), fileName);

          // Take screenshot of website
          logger.info(`${HOOK_NAME} hook: Puppeteer: Take screenshot`);
          await puppeteerPage.screenshot({ path: tmpFilePath });

          // Create files service instance
          const filesService = new FilesService({
            accountability: context.accountability,
            schema: context.schema,
          });

          // Upload image and set image ID
          logger.info(`${HOOK_NAME} hook: Upload screenshot`);
          imageId = await filesService.uploadOne(
            fs.createReadStream(tmpFilePath),
            {
              type: 'image/jpeg',
              filename_download: fileName,
              storage: process.env.STORAGE_LOCATIONS.split(',')[0],
            }
          );

          // If an error occurs, log it and inform team via Slack
        } catch (error) {
          logger.warn(`${HOOK_NAME} hook: Can't take screenshot`);
          logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
          await postSlackMessage(
            `Achtung: Der Screenshot für einen Pick of the Day konnte nicht automatisch erstellt werden. Der Screenshoot muss nun manuell über den folgenden Link hinzugefügt werden: ${
              process.env.PUBLIC_URL
            }admin/content/picks_of_the_day/${
              (metadata.keys && metadata.keys[0]) || ''
            }`
          );

          // Close puppeteer browser and delete temporary file
        } finally {
          logger.info(`${HOOK_NAME} hook: Cleanup process`);
          puppeteerBrowser && (await puppeteerBrowser.close());
          if (tmpFilePath) {
            fs.unlinkSync(tmpFilePath);
          }
        }

        // If image ID is available, log info and return payload with image
        if (imageId) {
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
