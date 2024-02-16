const jwt = require('jsonwebtoken');
const axios = require('axios').default;
const postSlackMessage = require('../../../helpers/postSlackMessage');
const { environment } = require('../../../utils/environment');

const HOOK_NAME = 'deployWebsite';

if (!environment.isProduction()) {
  console.info(
    `${HOOK_NAME} hook: Environment is not production, hook overwritten.`
  );

  module.exports = () => {}

  return;
}

module.exports = (
  { action },
  { env, exceptions: { BaseException }, logger, services: { ItemsService } }
) => {
  /**
   * It handles the action and deploys our website, if necessary.
   *
   * @param type The filter typ.
   * @param data The action data.
   */
  async function handleAction(type, { payload, metadata, context }) {
    try {
      // Log start info
      logger.info(
        `${HOOK_NAME} hook: Start "${metadata.collection}" action function`
      );

      // Get fields of collection
      const { fields } = context.schema.collections[metadata.collection];

      // Deploy website only if status field exists
      if (!fields.status) {
        return;
      }

      // Create items service instance
      const itemsService = new ItemsService(metadata.collection, {
        accountability: context.accountability,
        schema: context.schema,
      });

      // Get item from item service by key
      const item = await itemsService.readOne(metadata.key || metadata.keys[0]);

      // Deploy website only if it is a published item or
      // action type is "update" and status has changed
      const contentUpdateRelevant =
        item.status === 'published' || (type === 'update' && payload.status);

      if (!contentUpdateRelevant) {
        return;
      }

      await axios({
        method: 'POST',
        url: env.VERCEL_DEPLOY_WEBHOOK_URL,
      });
    } catch (error) {
      await postSlackMessage(
        `:warning: *${HOOK_NAME} hook*: Die Website konnte nicht automatisch deployed werden. Error: ${error.message}`
      );
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, 'UNKNOWN');
    }
  }

  /**
   * It deploys our website on created items, if necessary.
   */
  action('items.create', ({ payload, ...metadata }, context) =>
    handleAction('create', { payload, metadata, context })
  );

  /**
   * It deploys our website on updated items, if necessary.
   */
  action('items.update', ({ payload, ...metadata }, context) =>
    handleAction('update', { payload, metadata, context })
  );
};
