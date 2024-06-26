/**
 * THIS EXTENSION IS CURRENTLY DISABLED PROGRAMMATICALLY
 *
 * It is not listed in the package.json configuration, so it will not be picked up by directus
 * This extension was unused for quite some time because we did no longer use this transcription service
 * Hence, it was not refactored as part of the Directus 10.1 to 10.12 migration
 *
 * These files are for archival purpose only.
 * Once we pick up transcription again, we will need to heavily refactor this.
 *
 */

const retrievePodcast = require('./retrieveTranscription');
const triggerTranscription = require('./triggerTranscription');

module.exports = ({ schedule, action }, config) => {
  /**
   * It runs a cron job every minute that publishes items automatically.
   */
  schedule('*/1 * * * *', retrievePodcast(config));

  const trigger = triggerTranscription(config);

  action('podcasts.items.create', ({ payload, ...metadata }, context) =>
    trigger({ payload, metadata, context })
  );
  action('podcasts.items.update', ({ payload, ...metadata }, context) =>
    trigger({ payload, metadata, context })
  );
};
