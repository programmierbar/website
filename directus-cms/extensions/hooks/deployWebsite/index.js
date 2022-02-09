const jwt = require('jsonwebtoken');
const axios = require('axios').default;
const postSlackMessage = require('../../../helpers/postSlackMessage');

const HOOK_NAME = 'deployWebsite';

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
      if (fields.status) {
        // Create items service instance
        const itemsService = new ItemsService(metadata.collection, {
          accountability: context.accountability,
          schema: context.schema,
        });

        // Get item from item service by key
        const item = await itemsService.readOne(
          metadata.key || metadata.keys[0]
        );

        // Deploy website only if it is a published item or
        // action type is "update" and status has changed
        if (
          item.status === 'published' ||
          (type === 'update' && payload.status)
        ) {
          // Create GitHub App JWT
          const githubAppJwt = jwt.sign(
            {
              iss: env.GITHUB_APP_ID,
              iat: Math.floor(Date.now() / 1000) - 60,
              exp: Math.floor(Date.now() / 1000) + 60,
            },
            env.GITHUB_APP_PRIVATE_KEY,
            { algorithm: 'RS256' }
          );

          // Get GitHub App access token
          const githubAccessTokensResponse = await axios({
            method: 'POST',
            url: `${env.GITHUB_API_URL}app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
            headers: {
              Authorization: `Bearer ${githubAppJwt}`,
            },
          });

          /**
           * It reruns the latest GitHub Action workflow, if necessary.
           */
          const rerunLatestWorkflow = async () => {
            // Get GitHub Action runs of repository
            const githubActionRunsResponse = await axios({
              method: 'GET',
              url: `${env.GITHUB_API_URL}repos/${env.GITHUB_OWNER}/${env.GITHUB_REPOSITORY}/actions/runs`,
              headers: {
                Authorization: `Bearer ${githubAccessTokensResponse.data.token}`,
              },
            });

            // Get latest GitHub Action workflow run
            const latestWorkflowRun =
              githubActionRunsResponse.data.workflow_runs.find((workflowRun) =>
                workflowRun.name.includes('Deploy to Firebase Hosting')
              );

            // Continue if latest GitHub Action workflow run was found
            if (latestWorkflowRun) {
              // Cancel and than rerun latest GitHub Action workflow if
              // it is still in progress and not older than 3 minutes
              if (
                latestWorkflowRun.status === 'in_progress' &&
                new Date() - new Date(latestWorkflowRun.run_started_at) >
                  1000 * 60 * 3 // 3 minutes
              ) {
                // Cancel latest GitHub Action workflow
                await axios({
                  method: 'POST',
                  url: latestWorkflowRun.cancel_url,
                  headers: {
                    Authorization: `Bearer ${githubAccessTokensResponse.data.token}`,
                  },
                });

                // Wait 25 seconds and than rerun function
                await new Promise((res) => setTimeout(res, 1000 * 25));
                await rerunLatestWorkflow();

                // Rerun latest GitHub Action workflow
                // only if status is "completed"
              } else if (latestWorkflowRun.status === 'completed') {
                await axios({
                  method: 'POST',
                  url: latestWorkflowRun.rerun_url,
                  headers: {
                    Authorization: `Bearer ${githubAccessTokensResponse.data.token}`,
                  },
                });
              }

              // Otherwise, inform team via Slack that no latest
              // GitHub Action workflow run was found
            } else {
              await postSlackMessage(
                `Achtung: Die Website konnte nach Änderungen im CMS nicht automatisch aktualisiert werden. Der Rerun der GitHub Action muss nun manuell über den folgenden Link vorgenommen werden: ${env.GITHUB_URL}${env.GITHUB_OWNER}/${env.GITHUB_REPOSITORY}/actions`
              );
            }
          };

          // Rerun latest GitHub Action workflow
          await rerunLatestWorkflow();
        }
      }

      // Handle unknown errors
    } catch (error) {
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
