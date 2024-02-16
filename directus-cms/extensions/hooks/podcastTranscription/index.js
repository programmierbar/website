const retrievePodcast = require('./retrieveTranscription');
const triggerTranscription = require('./triggerTranscription');
const { environment } = require('../../../utils/environment');

const HOOK_NAME = 'podcastTranscription';

if (!environment.isProduction()) {
  console.info(
    `${HOOK_NAME} hook: Environment is not production, hook overwritten.`
  );

  module.exports = () => {}

  return;
}

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
