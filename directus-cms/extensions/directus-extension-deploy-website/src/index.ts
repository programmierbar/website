import postSlackMessage from "../../helpers/postSlackMessage";
import axios from "axios";

const HOOK_NAME = "deployWebsite";

export default (
  { action },
  { env, exceptions: { BaseException }, services },
) => {
  const { logger, ItemsService } = services;

  /**
   * It deploys our website on created items, if necessary.
   */
  action("items.create", ({ payload, ...metadata }, context) =>
    handleAction("create", { payload, metadata, context }),
  );

  /**
   * It deploys our website on updated items, if necessary.
   */
  action("items.update", ({ payload, ...metadata }, context) =>
    handleAction("update", { payload, metadata, context }),
  );

  async function handleAction(type, { payload, metadata, context }) {
    try {
      // Log start info
      logger.info(
        `${HOOK_NAME} hook: Start "${metadata.collection}" action function`,
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
        item.status === "published" || (type === "update" && payload.status);

      if (!contentUpdateRelevant) {
        return;
      }

      await axios({
        method: "POST",
        url: env.VERCEL_DEPLOY_WEBHOOK_URL,
      });
    } catch (error) {
      await postSlackMessage(
        `:warning: *${HOOK_NAME} hook*: Die Website konnte nicht automatisch deployed werden. Error: ${error.message}`,
      );
      logger.error(`${HOOK_NAME} hook: Error: ${error.message}`);
      throw new BaseException(error.message, 500, "UNKNOWN");
    }
  }
};
