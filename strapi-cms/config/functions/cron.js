'use strict';

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#cron-tasks
 */

module.exports = {
  /**
   * Publish scheduled podcast (execute every minute)
   */
  '*/1 * * * *': async () => {
    // Fetch podcasts to publish
    const draftPodcastsToPublish =
      await strapi.api.podcast.services.podcast.find({
        _publicationState: 'preview', // preview returns both draft and published entries
        published_at_null: true, // so we add another condition here to filter entries that have not been published
        publish_at_lt: new Date(),
        is_private: false,
      });

    // Update published_at of podcasts
    await Promise.all(
      draftPodcastsToPublish.map((podcast) => {
        return strapi.api.podcast.services.podcast.update(
          { id: podcast.id },
          { published_at: new Date() }
        );
      })
    );
  },
};
