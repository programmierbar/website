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
